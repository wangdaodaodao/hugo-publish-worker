# Hugo Publish Worker

基于 Cloudflare Workers 和 GitHub API 实现的静态博客在线发布平台。

## 系统架构与设计细节

### 1. 系统耦合性 (Low Coupling)
- **物理分离**：本项目作为独立的服务网关运行。前端由单一 HTML 文件构成。
- **配置无侵入**：不要求修改 Hugo 的配置文件 (`hugo.toml`)、模板逻辑或构建脚本。
- **托管方式**：发布页前端 (`admin/index.html`) 通过 Hugo 的 `static/` 目录进行物理托管。其逻辑与博客主站完全解耦。

### 2. 认证与安全机制 (Authentication)
- **核心机制**：采用 JWT (JSON Web Token) 签名验证。
- **存储与传输**：Token 存储在客户端的 HttpOnly Cookie 中。每次 API 调用自动携带。
- **服务端校验**：Worker 后端提取 Cookie 并通过部署时设置的 `JWT_SECRET` 进行加密签名校验。
- **权限管理**：GitHub Personal Access Token (PAT) 存储在 Cloudflare Secrets 中。未经授权的非法请求无法触及 GitHub 仓库写权限。

### 3. 多端同步逻辑 (Cloudflare D1)
- **数据流物理路径**：输入内容 -> 定时脚本触发 (每 30 秒) -> 边缘数据库 D1。
- **跨浏览器支持**：由于数据存储在云端 D1，用户在更换设备（手机、PC）或浏览器后，可通过 API 获取最近同步的草稿。

### 4. 媒体解耦与归档 (Cloudflare R2)
- **规避事实**：避免将二进制图片文件直接加入 Git 历史。
- **归档规则**：自动将文件重命名为 40 位 SHA-1 字符。按照 `YYYY/MM/` 路径物理归档。

## 部署方案

### 方式一：命令行部署 (推荐)
1. 克隆项目。
2. 重命名 `wrangler.toml.example` 为 `wrangler.toml`。
3. 执行 `npx wrangler deploy`。

### 方式二：手动部署 (Dashboard)
1. 在 Cloudflare 控制台创建新的 Worker。
2. 将 `worker/index.js` 中的代码内容复制并粘贴至 Worker 编辑箱。
3. 在 Settings -> Variables 中手动添加以下变量：
    - `GITHUB_OWNER`: 账号 ID
    - `GITHUB_REPO`: 仓库名
    - `DOMAIN`: 博客主域名
    - `R2_DOMAIN`: R2 访问域名
4. 添加 Secrets（加密变量）：
    - `GITHUB_TOKEN`: 建议仅开启 `repo` 作用域。
    - `JWT_SECRET`: 32 位以上随机字符串。
5. 在 Settings -> Bindings 中手动绑定关联的 D1 数据库和 R2 存储桶。

## 技术规格
- **Runtime**: Cloudflare Workers (V8)
- **API**: GitHub REST API v3
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3 Compatible)

## 许可证
MIT.
