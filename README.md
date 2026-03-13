# Hugo Publish Worker

> **让静态博客像动态 CMS 一样丝滑协作，却依然保持“纯静态”的灵魂。**

`hugo-publish-worker` 是一个基于 **Cloudflare Workers**、**D1**、**R2** 以及 **GitHub API** 搭建的轻量级、零成本、无服务器化（Serverless）的 Hugo 博客在线发布系统。它不仅是一个“发布工具”，更是为静态博客用户量身定制的“边缘写作大脑”。

---

## 💎 核心优势：为什么要用它？

市面上已有很多成熟的静态博客管理后台，但本项目更专注于 **"极简 + 零成本 + 无侵入"**。

### 1. 填补 Git 储存的“缝隙” (Powered by D1)
D1 数据库的引入是为了存放那些 **“不适合进 Git 仓库”** 的内容。
- **痛点**：草稿、自动保存记录、临时的元数据、短状态内容，如果全塞进 Git 仓库，会导致提交历史杂乱。
- **方案**：D1 刚好填补了这个缝。你可以放心地在各种浏览器上切换写作，所有未完成的灵感都妥善托管在边缘数据库中。

### 2. 写作体验的“现代化改造” (Powered by R2)
- **痛点**：图片不应该长期堆在 Git 仓库中。不仅增加体积，在手机、平板上写文章时，如何上传图片并获取 URL 是一个巨大的阻碍。
- **方案**：通过 R2 剥离媒体文件。你的 Git 依然轻量，而写作体验却追平了 Notion。支持 **拖拽即上传**，自动生成博客适配的短代码。

### 3. 发布过程的“双保险”系统
- **优势**：文章发布成功后，系统 **不再自动清理草稿**（由用户手动决定）。这意味着即便 Hugo 构建部署失败，你依然可以从 D1 草稿箱瞬间找回内容，进行调整。

### 4. 真正意义上的一站式零成本
- 利用 Cloudflare 的“大善人”计划：Worker（计算）、D1（SQL库）、R2（图床）均在免费额度内。你不需要维护任何服务器，不需要支付数据库月费。

---

## 🌟 功能特性

- ✅ **JWT 安全认证**：复用成熟的加密方案，确保只有你能通过 Web 端发布。
- ✅ **多端同步写作**：在手机灵感捕捉，在 PC 润色发布。
- ✅ **自动计算序号**：支持 `{序号}-{slug}.md` 命名风格，Worker 自动获取仓库最大序号并递增。
- ✅ **媒体管理**：内置 R2 桥接，支持图片上传、SHA-1 智能命名、按月自动归档。
- ✅ **响应式编辑**：简洁的左右分栏 UI，支持 Markdown 快捷工具栏和实时预览。
- ✅ **低侵入性**：它只是仓库的一个安全网关，不干预你原来的 Hugo 主题和构建逻辑。

---

## 🛠 技术栈

- **Runtime**: Cloudflare Workers (V8 Engine)
- **Database**: Cloudflare D1 (SQLite on Edge)
- **Storage**: Cloudflare R2 (S3-compatible)
- **API**: GitHub REST API
- **Auth**: JWT (JSON Web Token)

---

## 🚀 快速开始

### 1. 准备工作
- 拥有存放 Hugo 博客的 GitHub 仓库。
- 一个 Cloudflare 账号。
- 获取一个拥有 `repo` 权限的 [GitHub Personal Access Token](https://github.com/settings/tokens)。

### 2. 部署后端 (Worker)
1. 克隆本项目：`git clone https://github.com/wangdaodaodao/hugo-publish-worker.git`
2. 重命名 `wrangler.toml.example` 为 `wrangler.toml`。
3. 修改配置变量：
   - `DOMAIN`: 你的主博客域名。
   - `GITHUB_OWNER`: 你的用户名。
   - `GITHUB_REPO`: 你的仓库名。
4. 部署：`npx wrangler deploy`
5. 在 Cloudflare 控制台添加 Secret：
   - `GITHUB_TOKEN`: 你的 GitHub Token。
   - `JWT_SECRET`: 一个长随机字符串（建议 32 位以上）。

### 3. 配置数据库与存储 (可选但推荐)
- **D1 草稿箱**：
  ```bash
  npx wrangler d1 create your-db-name
  ```
  在 `wrangler.toml` 中绑定生成的 ID。
- **R2 图床**：
  在控制台创建桶并在 `wrangler.toml` 中绑定。

### 4. 部署前端
1. 修改 `admin/index.html` 中的 `API_BASE`。
2. 将 `admin/` 目录拷贝到你博客仓库的 `static/` 目录下。
3. 访问 `https://your-blog.com/admin/` 即可开启全新的写作体验。

---

## 📝 许可证

本项目采用 MIT 协议开源。

如果你觉得这个方案帮到了你，欢迎给个 Star 🌟！
