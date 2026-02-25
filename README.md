# 2FAuth Worker - Serverless 2FA Manager

**2FAuth Worker** 是一个基于 Cloudflare Workers + D1 (SQLite) + Vue 3 构建的轻量级、安全、无服务器的二步验证（2FA/TOTP）管理工具。

它允许你完全掌控自己的 2FA 数据，支持多端同步、WebDAV 备份、S3存储桶、加密导入导出，并且完全免费部署在 Cloudflare 的边缘网络上。 

## ✨ 功能特性

- ☁️ **Serverless 架构**：后端运行在 Cloudflare Workers，数据库使用 D1，无需购买服务器。
- ⚡️ **极速部署**: 利用 Github Actions 自动化部署，数分钟即可完成。
- 🔐 **OAuth2登录**：集成 GitHub 和 Cloudflare Access 安全登录。
- 🔒 **安全隐私**：数据存储在你的私有 D1 数据库中，支持 AES-GCM 高强度加密导出。
- 🖥️ **多端适配**：响应式设计，完美支持 PC 和移动端访问。
- 📷 **扫码添加**：支持调用摄像头扫描二维码或上传图片识别添加账号。
- 🔄 **数据同步**：支持 WebDAV,S3对象存储自动备份，数据永不丢失。
- 📂 **导入导出**：支持导出导入 加密JSON 格式、2FAS、标准 JSON 格式、otpauth格式数据。
- ⚙  **实用工具**：原生内置TOTP 密钥工具、时间校准器、二维码解析器等多款实用小工具。

## 🛠️ 技术栈

- **Frontend**: Vue 3, Vite, Element Plus, Pinia (State Management via Reactive)
- **Backend**: Cloudflare Workers, Hono (Web Framework)
- **Database**: Cloudflare D1 (Serverless SQLite)
- **Deployment**: GitHub Actions

## 🚀 部署指南 (Deployment)

本项目设计为通过 GitHub Actions 自动部署到 Cloudflare。

### 1. 准备工作

1.  注册一个 [Cloudflare](https://dash.cloudflare.com/) 账号。
2.  Fork 本仓库到你的 GitHub 账户。

### 2. 配置 Cloudflare D1 数据库

1.  登录 Cloudflare Dashboard。
2.  进入左侧菜单的 **存储和数据库** -> **D1 SQL 数据库**。
3.  点击 **+ 创建数据库** 创建新数据库，命名为 **2fauth-db**，点击 **创建** 确认。
4.  创建完成后，在数据库详情页找到 **Database ID** 并复制。
5.  请妥善保存这个 ID，稍后我们需要将其配置到 GitHub Secrets (`CLOUDFLARE_D1_DATABASE_ID`) 中。

 **以下GitHub OAuth 和  Cloudflare Access 至少配置一项用于登录**

### 3. 配置 GitHub OAuth

1.  访问 GitHub Developer Settings -> **OAuth Apps** -> **New OAuth App**。
2.  填写信息：
    - **Application Name**: 2FAuth (或任意名称)
    - **Homepage URL**: `https://你的Worker子域名.workers.dev` (部署后可修改为Worker绑定的自定义域名)
    - **Authorization callback URL**: `https://你的Worker子域名.workers.dev/oauth/callback` (部署后可修改为Worker绑定的自定义域名)
3.  创建后，保存 `Client ID` 并生成一个新的 `Client Secret`。

### 4. 配置 Cloudflare Access 

要启用 Cloudflare Access 登录，你需要：

1.  进入 **Cloudflare Zero Trust Dashboard** -> **Access** -> **Applications**。
2.  创建一个 **SaaS** 应用 (Select "SaaS")。
3.  配置 **Application**:
    - **应用程序**:  `输入任意名称都行，如 2fauth`
    - **选择身份验证协议**: `OIDC`
    - **重定向 URL**: ``https://你的Worker子域名.workers.dev/oauth/callback` (部署后可修改为Worker绑定的自定义域名)`
4.  复制保存关键信息备用， `客户端 ID` 和 `客户端密码`。
5.  配置 Access 策略
6.  其余均不需要额外配置，一直下一步到完成

### 5. 配置 GitHub Secrets

在你的 GitHub 仓库中，进入 **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**，添加以下变量：

| Secret Name | 说明 | 示例值 |
| `JWT_SECRET` | 用于签发登录 Token 的密钥 (随机字符串) | `random_string_here` |
| :--- | :--- | :--- |
| `ENCRYPTION_KEY` | 用于加密敏感数据的密钥 (32位随机字符串) | `openssl rand -hex 16` 生成 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID (在 Dash 面板右下角) | `a1b2...` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 (需有 Workers 和 D1 读写权限) | `r4_...` |
| `CLOUDFLARE_D1_DATABASE_ID` | 你的 D1 数据库 ID (步骤 2 中生成的) | `xxxxxxxx-xxxx...` |
| `CLOUDFLARE_D1_DATABASE_NAME` | 你的 D1 数据库 名称 (步骤 2 中生成的) | 默认`2fauth-db` |
| `OAUTH_ALLOWED_USERS` | 允许登录的邮箱或用户名白名单 (逗号分隔) | `me@example.com,my_github_id` |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth Client ID | `Ov23...` |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | `a1b2...` |
| `OAUTH_GITHUB_REDIRECT_URI` | 你的 Worker 回调地址 | `https://xxx.workers.dev/oauth/callback` |
| `OAUTH_CLOUDFLARE_CLIENT_ID` | Cloudflare Access 客户端 ID | `...` |
| `OAUTH_CLOUDFLARE_CLIENT_SECRET` | Cloudflare Access 客户端密码 | `..
| `OAUTH_CLOUDFLARE_ORG_DOMAIN` | Access 组织域名 | `https://<team>.cloudflareaccess.com` |
| `OAUTH_CLOUDFLARE_REDIRECT_URI` | 你的 Worker 回调地址 | `https://xxx.workers.dev/oauth/callback` |
| `OAUTH_NODELOC_CLIENT_ID` | NodeLoc OAuth Client ID | `Ov23...` |
| `OAUTH_NODELOC_CLIENT_SECRET` | NodeLoc OAuth Client Secret | `a1b2...` |
| `OAUTH_NODELOC_REDIRECT_URI` | 你的 Worker 回调地址 | `https://xxx.workers.dev/oauth/callback` |

### 6. 自动部署

1.  进入 GitHub 仓库的 **Actions** 页面。
2.  手动触发 `Deploy to Cloudflare Workers` 工作流，或者直接 Push 代码到 `main` 分支。
3.  等待工作流执行完毕。
4.  部署成功后，访问你的 Worker URL 即可使用！

> **注意**：首次部署时，GitHub Action 会自动执行 `schema.sql` 初始化数据库表结构。

---

## 💻 本地开发 (Local Development)

### 环境要求
- Node.js 20+
- npm

### 1. 克隆项目
```bash
git clone https://github.com/nap0o/2fauth-worker.git
cd 2fauth-worker
```

### 2. 安装依赖
```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install
```

### 3. 配置本地环境变量
在 `backend` 目录下创建 `.dev.vars` 文件，填入开发所需的 Secrets：
```ini
JWT_SECRET="本地测试用的JWT密钥"
ENCRYPTION_KEY="本地测试用的32位密钥"
OAUTH_ALLOWED_USERS="你的邮箱@example.com,你的GitHub用户名"
OAUTH_GITHUB_CLIENT_ID="Github测试AppID"
OAUTH_GITHUB_CLIENT_SECRET="Github测试AppSecret"
OAUTH_GITHUB_REDIRECT_URI="http://localhost:5173/oauth/callback"
OAUTH_CLOUDFLARE_CLIENT_ID="Cloudflare Access 测试客户端ID"
OAUTH_CLOUDFLARE_CLIENT_SECRET="Cloudflare Access 测试客户端密码"
OAUTH_CLOUDFLARE_REDIRECT_URI=http://localhost:8787/oauth/callback
OAUTH_CLOUDFLARE_ORG_DOMAIN=https://<你的组织名>.cloudflareaccess.com

```

### 4. 初始化本地数据库
```bash
cd backend
npx wrangler d1 execute 2fauth-db-dev --local --env dev --file=schema.sql
```

### 5. 启动开发服务器

**终端 1 (后端):**
```bash
cd backend
npm run dev
```

**终端 2 (前端):**
```bash
cd frontend
npm run dev
```