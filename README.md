# Hugo Publish Worker

基于 Cloudflare Workers 和 GitHub API 实现的静态博客在线发布工具。

## 项目背景

静态博客通常依赖本地 Hugo 编译环境和 Git 命令行操作。本项目通过 Web 端界面管理 Markdown 文件和元数据。

- **操作逻辑**：通过浏览器访问管理页，直接编辑内容并推送至 GitHub。无需本地环境。
- **成本数据**：利用 Cloudflare 免费额度。服务器运营费用为 0 元。
- **存储方案**：
    - 文章正文：提交至 GitHub。
    - 临时草稿：存入 Cloudflare D1 SQL 数据库。
    - 媒体文件：存入 Cloudflare R2 对象存储。

## 核心功能说明

### 1. 内容同步 (Cloudflare D1)
- **物理状态**：多设备（手机、平板、PC）之间缺乏统一的本地存储空间。
- **解决方案**：引入 D1 数据库作为中转。每间隔 30 秒将当前编辑器内容写入边缘数据库。
- **结果**：多浏览器访问时可自动读取最近一次保存的草稿。

### 2. 媒体处理 (Cloudflare R2)
- **物理事实**：图片属于二进制文件，直接存入 Git 仓库会导致 `.git` 文件夹体积由于历史记录累积而迅速膨胀。
- **操作流程**：
    1. 图片上传至 R2 存储桶。
    2. 系统自动计算文件 SHA-1 哈希值并作为文件名。
    3. 按照 `年/月/文件名` 物理路径归档。
- **自动化**：上传后自动在光标处插入公网 URL 或自定义短代码。

### 3. 序号计算逻辑
- **机制**：通过 GitHub API 扫描 `content/posts/` 目录下的 `.md` 文件。
- **量化结果**：识别最大数字前缀，自动加 1 生成新文件名。例如：现有 `38-post.md`，自动生成 `39-new-post.md`。

## 技术规格

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1
- **Object Storage**: Cloudflare R2
- **Authentication**: JWT Cookie
- **Protocol**: GitHub REST API v3

## 部署说明

### 1. 后端配置
- 准备一个具有 `repo` 权限的 GitHub Personal Access Token。
- 将 `wrangler.toml.example` 重命名为 `wrangler.toml`。
- 设置环境变量：
    - `GITHUB_TOKEN`: 认证令牌。
    - `JWT_SECRET`: 32 位以上字符串。
    - `GITHUB_OWNER`: GitHub ID。
    - `GITHUB_REPO`: 仓库名。

### 2. 数据库与存储绑定
```bash
# 创建 D1 数据库
npx wrangler d1 create <name>
# 在 wrangler.toml 中绑定 ID
```

### 3. 前端部署
- 修改 `admin/index.html` 中的 `API_BASE` 指向 Worker 域名。
- 将 `admin` 目录复制到 Hugo 仓库的 `static/` 路径。

## 许可证
MIT.
