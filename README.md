# Hugo Publish Worker

一个基于 Cloudflare Worker + GitHub API 的 Hugo 静态博客在线发布系统。

## 🌟 特性

- **零成本**：利用 Cloudflare Worker 免费额度，无需购买服务器。
- **无状态**：直连 GitHub API，文章存放在你的 Git 仓库中。
- **支持草稿**：利用 Cloudflare D1 数据库存储未发布的灵感。
- **图片上传**：内置 R2 桥接，支持直接上传图片到 R2 存储桶。
- **极致安全**：采用 JWT Cookie 认证，防止非法发布。

## 🚀 快速开始

### 1. 准备工作

- 一个 GitHub 账号及存放 Hugo 博客的仓库。
- 一个 [Cloudflare](https://www.cloudflare.com/) 账号。
- 一个 GitHub Personal Access Token (PAT)，需要 `repo` 权限。

### 2. 部署后端 (Worker)

1. 克隆本项目。
2. 将 `wrangler.toml.example` 重命名为 `wrangler.toml` 并修改以下变量：
   - `DOMAIN`: 你的博客域名。
   - `GITHUB_OWNER`: 你的 GitHub 用户名。
   - `GITHUB_REPO`: 你的博客仓库名。
3. 在 Cloudflare Dashboard 的 Worker 设置中添加 Secrets：
   - `GITHUB_TOKEN`: 你的 GitHub PAT。
   - `JWT_SECRET`: 一个随机的长字符串。
4. 运行 `npx wrangler deploy` 进行部署。

### 3. 配置 D1 和 R2 (可选)

- **D1 草稿箱**：创建一个 D1 数据库，并在 `wrangler.toml` 中绑定为 `DB`。
- **R2 图床**：创建一个 R2 Bucket，并在 `wrangler.toml` 中绑定为 `R2`。

### 4. 部署前端

1. 修改 `admin/index.html` 中的 `API_BASE` 为你的 Worker 地址。
2. 将 `admin` 目录下的文件放入你 Hugo 博客的 `static/admin` 目录下。
3. 重新构建并发布博客。

## 📝 许可证

MIT License.
