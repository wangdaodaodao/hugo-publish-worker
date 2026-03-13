# Hugo Publish Worker

基于 Cloudflare Workers 实现的静态博客发布网关。

## 解决的问题 (Problem Statement)
- **操作局限**：静态博客通常要求本地具备 Hugo 编译环境和 Git 客户端，无法实现跨设备随时发布。
- **存储冗余**：将二进制媒体文件（图片）直接存入 Git 仓库会导致历史记录体积线性增加。
- **状态维护**：多端协作时，未发布的 Markdown 草稿缺乏物理同步空间。

## 系统特性
- **低耦合性**：前端采用单一 HTML 文件托管于 `static/` 目录，不参与 Hugo 任务构建逻辑。
- **安全机制**：API 采用 JWT (JSON Web Token) 签名验证。GitHub Token 等敏感信息仅存储于 Cloudflare Secrets。
- **资产分离**：文本内容推送到 GitHub 仓库，二进制媒体文件推送到 Cloudflare R2，实现文本与媒体的物理隔离。

## 部署流程 (Deployment)

### 1. 资源准备
- 在 Cloudflare 创建 D1 数据库（用于草稿同步）。
- 在 Cloudflare 创建 R2 存储桶（用于图片存储）。

### 2. 后端部署 (Worker)
可以通过 `npx wrangler deploy` 或在 Cloudflare Dashboard 手动创建服务：
- **源代码**：粘贴 `worker/index.js` 中的脚本。
- **环境变量 (Variables)**：
    - `GITHUB_API_URL`: 设置为目标仓库的 Contents API 路径（例如：`https://api.github.com/repos/USER/REPO/contents`）。
    - `R2_DOMAIN`: 分配给 R2 桶的公网访问域名。
- **加密变量 (Secrets)**：
    - `GITHUB_TOKEN`: 具备 `repo` 权限的个人访问令牌。
    - `JWT_SECRET`: 校验 Cookie 签名的字符序列。
- **项目绑定 (Bindings)**：
    - 变量名 `DB` 绑定至 D1 数据库项目。
    - 变量名 `R2` 绑定至 R2 存储桶项目。
- **独立域名**：在 `Settings -> Domains` 中为 Worker 绑定一个独立二级域名，作为 API 的通信入口。

### 3. 前端接入
- 将 `admin/index.html` 复制到博客源码 `static/admin/` 目录。
- 将 `CONFIG.API_BASE` 设置为第 2 步中绑定的 Worker 域名。

## 技术栈
- **运行时**: Cloudflare Workers
- **持久化**: GitHub API (Git), Cloudflare D1 (SQL)
- **存储**: Cloudflare R2 (S3 Compatible)
- **认证**: JWT on HTTP Cookie

## 许可证
MIT.
