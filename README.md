# Hugo Publish Worker

基于 Cloudflare Workers 和 GitHub API 实现的静态博客在线发布平台。

## 系统架构与设计细节

### 1. 系统耦合性 (Low Coupling)
- **物理分离**：本项目作为独立的服务网关运行。前端由单一 HTML 文件构成。
- **配置无侵入**：不要求修改 Hugo 的配置文件 (`hugo.toml`)、模板逻辑或构建脚本。
- **物理托管**：发布页前端 (`admin/index.html`) 存放于 Hugo 仓库的 `static/` 目录。其逻辑与博客主站完全解耦，不参与 Hugo 编译过程。

### 2. 认证与安全机制 (Authentication)
- **鉴权协议**：采用 JWT (JSON Web Token) 签名验证。
- **数据存储**：Token 存储在客户端浏览器的身份验证 Cookie 中。
- **校验逻辑**：Worker 后端通过部署时生成的文本密钥 (`JWT_SECRET`) 校验签名完整性。
- **仓库写限制**：GitHub Personal Access Token (PAT) 仅存于 Cloudflare 服务端加密变量。未经授权的 API 请求无法触发 GitHub 文件更改。

### 3. 多端同步逻辑 (Cloudflare D1)
- **数据链路**：输入内容 -> 事件触发 (每 30 秒) -> D1 数据库持久化。
- **跨端获取**：任意登录后的浏览器均通过 `/get-draft` 接口从 D1 调取最近写入的数据状态。

### 4. 媒体解耦与归档 (Cloudflare R2)
- **物理脱离**：二进制图片文件不进入 Git 历史版本。
- **命名规范**：采用 40 位 SHA-1 哈希值命名以防止重复上传。

## 部署方案

### 命令行部署 (推荐)
1. 将 `wrangler.toml.example` 重命名为 `wrangler.toml`。
2. 填写 `GITHUB_OWNER`、`GITHUB_REPO` 及域名变量。
3. 执行 `npx wrangler deploy`。

### 手动部署 (控制台演示)
若不使用命令行工具，可按照以下物理步骤操作：

1. **创建服务**：在 Cloudflare Dashboard 开启一个新的 Workers 项目，粘贴 `worker/index.js` 代码并保存。
2. **资源绑定 (Settings -> Bindings)**：
    - **D1 数据库**：添加绑定，变量名设为 `DB`，关联你的草稿数据库。
    - **R2 存储桶**：添加绑定，变量名设为 `R2`，关联你的图片存储桶。
3. **域名绑定 (Settings -> Domains)**：
    - 为该 Worker 绑定一个自定义二级域名（如 `publish.yourdomain.com`），作为 API 的访问入口。
4. **配置参数 (Settings -> Variables)**：
    - **普通变量**：添加 `GITHUB_OWNER`、`GITHUB_REPO`、`DOMAIN` 及 `R2_DOMAIN`。
    - **加密变量 (Secrets)**：添加 `GITHUB_TOKEN` (GitHub 个人访问令牌) 及 `JWT_SECRET` (签名随机字符)。
5. **前端接入**：
    - 将 `admin/index.html` 复制到博客源码的 `static/admin/` 目录。
    - 将代码中 `CONFIG.API_BASE` 指向第 3 步绑定的二级域名。

## 技术规格
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **Protocol**: GitHub REST API v3

## 许可证
MIT.
