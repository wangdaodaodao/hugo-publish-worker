/**
 * Hugo 博客发布 Worker
 * 功能：通过 GitHub API 发布文章和图片
 * 
 * 环境变量 (在 Cloudflare Dashboard 或 wrangler.toml 设置):
 * - JWT_SECRET: JWT 签名密钥（建议至少 32 位随机字符）
 * - GITHUB_TOKEN: GitHub Personal Access Token（需有 repo 权限）
 * - GITHUB_OWNER: GitHub 用户名
 * - GITHUB_REPO: GitHub 仓库名
 * - DOMAIN: 你的博客主域名 (用于 CORS 校验)
 * - R2_DOMAIN: 你的 R2 图片公网域名
 * 
 * D1 数据库绑定:
 * - DB: 绑定到一个 D1 数据库，用于存储未发布的草稿。
 * 
 * R2 存储桶绑定:
 * - R2: 绑定到图片存储桶，用于图片上传。
 */

// 配置
const CONFIG = {
  GITHUB_BRANCH: 'main', // 默认分支
  POSTS_PATH: 'content/posts', // 文章存放路径
};

// CORS 处理函数
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  // 允许本地开发测试和正式域名
  const allowedOrigins = [
    `https://${env.DOMAIN}`,
    'http://localhost:1313'
  ];
  
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// JWT Cookie 名称
const AUTH_COOKIE = 'publish_token';

let isTableEnsured = false;

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (!isTableEnsured) {
        await ensureDraftsTable(env);
        isTableEnsured = true;
      }

      if (path === '/publish' && request.method === 'POST') {
        return await handlePublish(request, env, corsHeaders);
      }
      
      if (path === '/upload-image' && request.method === 'POST') {
        return await handleImageUpload(request, env, corsHeaders);
      }

      if (path === '/save-draft' && request.method === 'POST') {
        return await handleSaveDraft(request, env, corsHeaders);
      }

      if (path === '/get-draft' && request.method === 'GET') {
        const id = url.searchParams.get('id');
        return await handleGetDraft(env, id, corsHeaders);
      }

      if (path === '/list-drafts' && request.method === 'GET') {
        return await handleListDrafts(env, corsHeaders);
      }

      if (path === '/delete-draft' && request.method === 'POST') {
        return await handleDeleteDraft(request, env, corsHeaders);
      }

      if (path === '/auth-check' && request.method === 'GET') {
        const authResult = await verifyAuth(request, env);
        return jsonResponse({ authenticated: authResult.valid }, authResult.valid ? 200 : 401, corsHeaders);
      }

      return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);

    } catch (error) {
      console.error('Worker Error:', error);
      return jsonResponse({ error: error.message }, 500, corsHeaders);
    }
  }
};

async function verifyAuth(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[AUTH_COOKIE];
  if (!token || !env.JWT_SECRET) return { valid: false };

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload && payload.exp > Date.now() / 1000) return { valid: true, payload };
  } catch (e) {}
  return { valid: false };
}

async function handlePublish(request, env, corsHeaders) {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);

  const body = await request.json();
  const { title, content, slug, date, tags = [], category = '', description, image, ...rest } = body;

  if (!title || !content) return jsonResponse({ error: 'Title and content are required' }, 400, corsHeaders);

  const fileSlug = slug || generateSlug(title);
  const githubToken = env.GITHUB_TOKEN;
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) return jsonResponse({ error: 'GitHub config missing' }, 500, corsHeaders);

  // 获取下一个序号
  const nextNumber = await getNextPostNumber(owner, repo, CONFIG.POSTS_PATH, githubToken);
  const filename = `${String(nextNumber).padStart(2, '0')}-${fileSlug}.md`;
  const filePath = `${CONFIG.POSTS_PATH}/${filename}`;

  const frontmatter = generateFrontmatter({
    title, date: date || new Date().toISOString(), tags, category, description, image, slug: fileSlug, ...rest
  });

  const fileContent = `${frontmatter}\n${content}`;
  const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

  const result = await createOrUpdateFile(owner, repo, filePath, base64Content, `Publish: ${title}`, githubToken);

  if (result.error) return jsonResponse({ error: result.error }, 500, corsHeaders);

  return jsonResponse({ success: true, filename }, 200, corsHeaders);
}

async function handleImageUpload(request, env, corsHeaders) {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);

  const bucket = env.R2;
  if (!bucket) return jsonResponse({ error: 'R2 Bucket not bound' }, 500, corsHeaders);

  const formData = await request.formData();
  const file = formData.get('image');
  if (!file || !(file instanceof File)) return jsonResponse({ error: 'No image' }, 400, corsHeaders);

  try {
    const now = new Date();
    const prefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const arrayBuffer = await file.arrayBuffer();
    const hash = await computeHash(arrayBuffer);
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const key = `${prefix}/${hash}.${ext}`;

    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'image/jpeg', cacheControl: 'public, max-age=31536000' }
    });

    const publicUrl = `https://${env.R2_DOMAIN}/${key}`;
    return jsonResponse({
      success: true,
      url: publicUrl,
      markdown: `![${file.name}](${publicUrl})` // 这里可以根据博客短代码修改
    }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function ensureDraftsTable(env) {
  if (!env.DB) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS blog_drafts (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      data TEXT,
      updated_at INTEGER
    )
  `).run();
}

async function handleListDrafts(env, corsHeaders) {
  if (!env.DB) return jsonResponse({ error: 'D1 not bound' }, 500, corsHeaders);
  const result = await env.DB.prepare("SELECT id, title, updated_at FROM blog_drafts ORDER BY updated_at DESC").all();
  return jsonResponse({ drafts: result.results }, 200, corsHeaders);
}

async function handleGetDraft(env, id, corsHeaders) {
  if (!env.DB) return jsonResponse({ error: 'D1 not bound' }, 500, corsHeaders);
  const query = id ? "SELECT * FROM blog_drafts WHERE id = ?" : "SELECT * FROM blog_drafts ORDER BY updated_at DESC LIMIT 1";
  const draft = id ? await env.DB.prepare(query).bind(id).first() : await env.DB.prepare(query).first();
  return jsonResponse({ draft: draft ? JSON.parse(draft.data) : null }, 200, corsHeaders);
}

async function handleSaveDraft(request, env, corsHeaders) {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  if (!env.DB) return jsonResponse({ error: 'D1 not bound' }, 500, corsHeaders);

  const body = await request.json();
  const id = body.draftId || body.title || 'untitled';
  await env.DB.prepare(`
    INSERT INTO blog_drafts (id, title, content, data, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, data=excluded.data, updated_at=excluded.updated_at
  `).bind(id, body.title || 'Untitled', body.content || '', JSON.stringify(body), Date.now()).run();

  return jsonResponse({ success: true, id }, 200, corsHeaders);
}

async function handleDeleteDraft(request, env, corsHeaders) {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  const { id } = await request.json();
  await env.DB.prepare("DELETE FROM blog_drafts WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function createOrUpdateFile(owner, repo, path, content, message, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let sha = null;
  const checkRes = await fetch(url, {
    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'CF-Worker' }
  });
  if (checkRes.ok) sha = (await checkRes.json()).sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'CF-Worker' },
    body: JSON.stringify({ message, content, sha, branch: CONFIG.GITHUB_BRANCH })
  });

  return res.ok ? await res.json() : { error: await res.text() };
}

async function getNextPostNumber(owner, repo, path, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'CF-Worker' }
  });
  if (!res.ok) return 1;
  const files = await res.json();
  const numbers = files.filter(f => f.name.endsWith('.md')).map(f => {
    const match = f.name.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 0;
  });
  return Math.max(...numbers, 0) + 1;
}

function generateFrontmatter(data) {
  const { title, date, tags, category, slug, ...rest } = data;
  const d = new Date(date);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  
  let fm = `+++\ndate = '${dateStr}'\ntitle = '${title.replace(/'/g, "''")}'\ndraft = false`;
  if (slug) fm += `\nslug = "${slug}"`;
  if (category) fm += `\ncategories = ["${category}"]`;
  if (Array.isArray(tags) && tags.length) fm += `\ntags = [${tags.map(t => `"${t}"`).join(', ')}]`;
  
  // 额外字段遍历
  Object.keys(rest).forEach(key => {
    const val = rest[key];
    if (typeof val === 'boolean') fm += `\n${key} = ${val}`;
    else if (typeof val === 'string') fm += `\n${key} = "${val.replace(/"/g, '\\"')}"`;
    else if (Array.isArray(val)) fm += `\n${key} = [${val.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`;
  });
  
  return fm + '\n+++\n';
}

function generateSlug(title) {
  return title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50) || 'untitled';
}

async function computeHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(header) {
  return header.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});
}

async function verifyJWT(token, secret) {
  try {
    const [header, payload, sig] = token.split('.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)), new TextEncoder().encode(`${header}.${payload}`));
    return valid ? JSON.parse(atob(payload)) : null;
  } catch (e) { return null; }
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
