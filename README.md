<div align="center">

# Eric Blog

**极简主义个人博客**

基于 Next.js 16 全栈架构，中文黑白设计语言。(本文为AI生成)

[Next.js](https://nextjs.org/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS 4](https://tailwindcss.com/) · [Prisma](https://www.prisma.io/) · [SQLite](https://www.sqlite.org/) · [shadcn/ui](https://ui.shadcn.com/) · [Zustand](https://zustand.docs.pmnd.rs/)

</div>

---

- [特性](#特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [AI 助手配置](#ai-助手配置)
- [Markdown 文件系统](#markdown-文件系统)
- [常见问题](#常见问题)
- [部署](#部署)

---

## 特性

### 写作与编辑

- **Markdown 编辑器** — 集成 `@uiw/react-md-editor`，支持实时预览、语法高亮、拖拽上传图片
- **AI 辅助写作** — 一键生成文章标题、摘要、标签（支持任意 OpenAI 兼容 API）
- **标题候选选择** — AI 生成 3-5 个标题候选，弹窗选择最佳标题（非自动替换）
- **文章管理** — 创建、编辑、发布、草稿保存、删除，支持分类与标签体系
- **内联新建分类** — 编辑文章时可直接在分类选择器旁新建分类，无需跳转
- **动态分类与标签** — 分类和标签从数据库动态加载，支持后台增删改查
- **封面图片** — 支持自定义封面 URL 或本地上传图片，文章卡片自动适配无封面时的渐变占位

### 阅读体验

- **精致排版** — 精心调校的中文排版 CSS，涵盖标题层级、引用块、代码块、表格、图片、分割线等全部元素
- **代码高亮** — 基于 `react-syntax-highlighter`，自动适配亮色/暗色主题（One Dark / One Light）
- **一键复制代码** — 代码块右上角复制按钮，成功后显示绿色勾选反馈
- **目录导航 (TOC)** — 自动提取 h2/h3 标题生成侧边栏目录，滚动追踪高亮当前章节
- **阅读时间估算** — 根据中文字符 / 英文单词自动计算预计阅读分钟数
- **AI 摘要** — 阅读时一键生成文章智能摘要，弹窗展示
- **XSS 防护** — 集成 `rehype-sanitize`，安全渲染 Markdown 内容
- **侧边栏** — 首页侧边栏展示个人资料、分类导航、近期文章、标签云和站点统计

### 双存储文章系统

- **数据库 + Markdown 文件** — 文章同时存储在 SQLite 数据库和 `content/` 目录的 `.md` 文件中
- **MD 文件优先读取** — 查看文章时优先从 `.md` 文件加载内容，数据库作为备用
- **MD 文件自动同步** — 通过编辑器创建/更新文章时自动同步写入 `.md` 文件
- **一键导入 MD 文件** — 管理后台「同步 MD」按钮，将 `content/` 目录中手动放置的 `.md` 文件批量导入数据库
- **标准 Frontmatter 格式** — `.md` 文件使用 YAML frontmatter 存储元数据（标题、分类、标签、摘要、封面等）
- **文章端口性** — `.md` 文件可直接用任何 Markdown 编辑器编辑，也可迁移至其他静态博客系统

### 自建图床系统

- **本地图片存储** — 图片上传至 `public/uploads/` 目录，不依赖任何第三方图床服务
- **安全上传** — 文件类型白名单（JPEG/PNG/WebP/GIF/BMP/TIFF/SVG/AVIF）、10MB 大小限制、随机文件名防冲突、路径穿越防护
- **统一上传接口** — `POST /api/upload/image`（上传）、`GET /api/upload/image`（列表）、`DELETE /api/upload/image?fileName=xxx`（删除）
- **自动清理** — 删除文章时自动清理封面图片和正文中的本地上传图片；删除画廊图片时同步删除本地文件；更换首页背景时清理旧文件
- **多处调用** — 文章编辑器插入图片、文章封面上传、画廊图片上传、首页背景上传，共用同一套图床接口

### 互动与社区

- **评论系统** — 支持登录用户和游客评论，支持嵌套回复
- **点赞与分享** — 文章点赞 + 复制链接分享

### 设计与交互

- **黑白极简设计** — 全站黑白灰设计语言，亮色/暗色双主题
- **主题切换** — 一键切换亮色 / 暗色模式（`next-themes`）
- **视频背景首页** — 可自定义首页视频背景（管理员后台设置）
- **流畅动画** — 基于 `framer-motion` 的页面切换、列表加载、导航指示器动画
- **响应式布局** — 完整适配桌面端和移动端，含移动端抽屉菜单
- **运行天数统计** — 首次初始化时记录建站时间，页脚自动显示运行天数

### 安全与管理

- **API 域名白名单** — `proxy.ts` 实现域名级别的 API 访问控制，管理员可在后台配置允许访问的域名
- **JWT 认证** — 基于 `jose` 的 JWT Token 认证机制
- **管理员后台** — 文章列表、搜索筛选、状态切换（发布/草稿）、可见性管理（公开/登录可见/私密）、MD 文件同步
- **画廊管理** — 图片画廊功能，支持标签分类、文件上传和本地图片自动清理

---

## 技术栈

| 层级     | 技术                                                         |
| -------- | ------------------------------------------------------------ |
| 框架     | Next.js 16 (App Router, Standalone Output)                   |
| 语言     | TypeScript 5                                                 |
| 样式     | Tailwind CSS 4 + `tw-animate-css`                            |
| UI 组件  | shadcn/ui (Radix UI)                                         |
| 状态管理 | Zustand (persist middleware)                                 |
| 数据库   | SQLite + Prisma ORM                                          |
| 认证     | JWT (`jose`) + `bcryptjs`                                    |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` + `rehype-autolink-headings` |
| 编辑器   | `@uiw/react-md-editor`                                       |
| 代码高亮 | `react-syntax-highlighter`                                   |
| 动画     | Framer Motion                                                |
| 图标     | Lucide React                                                 |
| 主题     | `next-themes`                                                |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9（或 pnpm / yarn / bun）

### 安装与运行

- 配置环境变量:
   1. 编辑 env.txt，修改 JWT_SECRET 为你自己的随机字符
   2. 把 env.txt 重命名为 `.env`
   3. 把 `next.config.ts` 中的 `allowedDevOrigins: ["192.168.X.X"]` 里面的IP改成你的
   4. 接着运行下面的命令

```bash
# 1. 克隆项目
git clone https://github.com/Eq52/EricBlog eric-blog
cd eric-blog

# 2. 安装依赖
npm install

# 3. 初始化数据库
npm run setup

# 4. 启动开发服务器
npm run dev
```

浏览器访问 `http://localhost:3000`。

### 初始化管理员账户

首次部署后，浏览器直接访问以下地址即可自动创建管理员账户：

```
http://localhost:3000/api/init
```

默认管理员凭据：

- 邮箱：`admin@admin.com`
- 密码：`1029384756`

> **安全提醒**：登录后请立即修改默认密码。

---

## 项目结构

```
eric-blog/
├── content/                      # Markdown 文章文件目录
│   └── *.md                      # 带 YAML frontmatter 的文章文件
├── prisma/
│   ├── schema.prisma              # 数据库模型定义（Article, Category, Tag, User 等）
│   └── db/custom.db               # SQLite 数据库文件（自动生成）
├── public/
│   ├── uploads/                   # 本地图床存储目录（运行时自动填充）
│   │   └── .gitkeep                # 保持目录结构
│   ├── avatar.jpg                 # 默认头像
│   ├── logo.svg                   # Logo
│   └── robots.txt                 # 搜索引擎爬虫配置
├── src/
│   ├── app/
│   │   ├── globals.css            # 全局样式（主题变量 + 文章排版 CSS）
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx               # SPA 入口页
│   │   ├── article/[id]/          # 文章详情页
│   │   ├── gallery/               # 画廊页
│   │   ├── about/                 # 关于页
│   │   └── api/                   # API 路由
│   │       ├── init/               # 管理员初始化（自动创建 .md 文件）
│   │       ├── auth/               # 登录认证
│   │       ├── articles/           # 文章 CRUD（支持 MD 双写）
│   │       │   ├── meta/           # 分类/标签元数据
│   │       │   └── sync-md/        # MD 文件批量导入
│   │       ├── categories/         # 分类 CRUD
│   │       ├── tags/               # 标签 CRUD
│   │       ├── comments/           # 评论
│   │       ├── gallery/            # 画廊图片
│   │       ├── admin/              # 管理员设置（AI 配置、站点设置）
│   │       │   └── settings/
│   │       │       └── landing/    # 首页背景设置
│   │       ├── ai/summarize/       # AI 摘要 / 标题 / 标签生成
│   │       ├── stats/              # 统计（含运行天数）
│   │       └── upload/image/       # 自建图床（上传/列表/删除）
│   ├── components/
│   │   ├── blog/                   # 博客前台组件
│   │   │   ├── Navbar.tsx          # 导航栏（搜索、主题切换、用户菜单）
│   │   │   ├── HomeView.tsx        # 首页（文章卡片网格、分页、侧边栏）
│   │   │   ├── Sidebar.tsx         # 侧边栏（个人资料、分类、近期文章、标签云）
│   │   │   ├── ArticleView.tsx     # 文章阅读（TOC、代码复制、AI 摘要）
│   │   │   ├── CommentSection.tsx  # 评论区（嵌套回复）
│   │   │   ├── AuthViews.tsx       # 登录视图
│   │   │   ├── ProfileView.tsx     # 个人中心（含 AI 助手配置面板）
│   │   │   ├── LogoIcon.tsx        # Logo 图标组件
│   │   │   └── Footer.tsx          # 页脚（含运行天数计数器）
│   │   ├── admin/                  # 管理后台组件
│   │   │   ├── AdminView.tsx       # 文章管理列表（含 MD 同步按钮）
│   │   │   └── ArticleEditor.tsx   # Markdown 编辑器（AI 辅助、内联新建分类、图床上传）
│   │   └── ui/                     # shadcn/ui 组件
│   ├── hooks/                      # 自定义 Hooks（toast、mobile）
│   ├── lib/                        # 工具函数
│   │   ├── db.ts                   # Prisma 数据库单例
│   │   ├── auth.ts                 # JWT 认证与密码加密
│   │   ├── constants.ts            # 站点常量与配置
│   │   ├── md-files.ts             # Markdown 文件读写工具（frontmatter 解析）
│   │   └── utils.ts                # 通用工具函数
│   ├── proxy.ts                    # API 域名白名单代理
│   └── store/                      # Zustand 状态管理
├── env.txt                          # 环境变量模板
├── next.config.ts                   # Next.js 配置
├── tailwind.config.ts               # Tailwind CSS 配置
├── package.json
└── tsconfig.json
```

---

## 常用命令

| 命令                 | 说明                                                |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | 启动开发服务器（默认端口 3000）                     |
| `npm run build`      | 构建生产版本                                        |
| `npm run start`      | 启动生产服务器                                      |
| `npm run setup`      | 初始化数据库（`prisma generate && prisma db push`） |
| `npm run lint`       | ESLint 代码检查                                     |
| `npm run db:push`    | 同步数据库 Schema                                   |
| `npm run db:migrate` | 运行数据库迁移                                      |

---

## AI 助手配置

AI 功能（摘要生成、标题生成、标签生成）现在通过**个人中心页面**进行配置，支持任意 OpenAI 兼容接口（DeepSeek、Moonshot、Ollama、通义千问等），无需修改代码。

### 配置步骤

1. 登录管理员账号
2. 点击右上角用户头像 → 进入「个人中心」
3. 在「AI 助手配置」面板中填写：
   - **服务商** — 选择预设（讯飞星火 / DeepSeek / OpenAI / 月之暗面）或选择「自定义」
   - **API 地址** — 输入你的 API 端点（如 `https://api.deepseek.com`，系统会自动拼接 `/v1/chat/completions`）
   - **API Key** — 输入你的密钥（无需手动添加 `Bearer` 前缀）
   - **模型名称** — 输入模型标识（如 `deepseek-chat`、`glm-4`、`qwen-turbo`）

### 智能地址拼接

系统会自动处理 API 地址：

| 你填写的地址 | 实际请求地址 |
|-------------|-------------|
| `https://api.deepseek.com` | `https://api.deepseek.com/v1/chat/completions` |
| `https://api.deepseek.com/v1` | `https://api.deepseek.com/v1/chat/completions` |
| `https://api.deepseek.com/v1/chat/completions` | `https://api.deepseek.com/v1/chat/completions`（不重复拼接） |

### 常见服务商配置参考

| 服务商   | API 地址 | 模型名称 |
| -------- | -------- | -------- |
| 讯飞星火 | `https://spark-api-open.xf-yun.com` | `lite` / `generalv3` / `4.0Ultra` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` / `deepseek-coder` |
| OpenAI   | `https://api.openai.com` | `gpt-4o-mini` / `gpt-4o` |
| 月之暗面 | `https://api.moonshot.cn` | `moonshot-v1-8k` / `moonshot-v1-32k` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode` | `qwen-turbo` / `qwen-plus` |
| Ollama (本地) | `http://localhost:11434` | `llama3` / `qwen2` |

### AI 请求超时

AI 接口请求超时时间为 **30 秒**，超时后返回友好错误提示。

---

## Markdown 文件系统

项目采用**数据库 + Markdown 文件双存储**架构，兼顾动态博客功能和文章可移植性。

### 文件格式

`.md` 文件存储在项目根目录的 `content/` 文件夹中，使用标准 YAML frontmatter 格式：

```markdown
---
title: 我的文章标题
category: 技术
tags: ["Next.js", "React", "教程"]
summary: 这是一篇关于 Next.js 的技术教程
coverImage: https://example.com/cover.jpg
status: published
visibility: public
createdAt: 2025-01-01T00:00:00.000Z
updatedAt: 2025-01-15T00:00:00.000Z
---

文章正文内容（支持完整 Markdown 语法）...

## 二级标题

### 三级标题

- 列表项
- **加粗** / *斜体*
- `行内代码`

> 引用块

| 表头1 | 表头2 |
|-------|-------|
| 内容  | 内容  |
```

### 工作流程

```
编辑器创建/更新文章
    ├── 写入 SQLite 数据库
    └── 同步写入 content/{slug}.md

查看文章
    ├── 优先读取 content/{slug}.md 文件内容
    └── .md 文件不存在时回退到数据库内容

手动放入 .md 文件
    └── 管理后台点击「同步 MD」→ 导入到数据库
```

### MD 文件导入

1. 将编写好的 `.md` 文件放入 `content/` 目录（确保文件名不含特殊字符）
2. 登录管理后台，点击顶部「**同步 MD**」按钮
3. 系统自动扫描并导入新文件（已存在的不会覆盖）
4. 导入结果会显示导入数量和跳过数量

### 迁移到其他博客

`content/` 目录中的 `.md` 文件可直接用于：
- Hexo / Hugo / Jekyll 等静态博客（需适配 frontmatter 字段名）
- Notion / Obsidian 等笔记工具（直接导入 Markdown）
- 任何支持 Markdown 的 CMS 系统

---

## 常见问题

<details>
<summary><strong>SWC 二进制文件损坏</strong></summary>

```
⨯ Failed to load SWC binary for win32/x64
```

删除 `node_modules` 并重新安装：

```cmd
rmdir /s /q node_modules
npm cache clean --force
npm install
npm run setup
npm run dev
```

如果问题仍然存在，尝试手动重建 SWC：

```cmd
npm rebuild @next/swc-win32-x64-msvc
```

</details>

<details>
<summary><strong>中国大陆网络环境下 Prisma 引擎下载失败</strong></summary>

如果 `npm install` 时出现 Prisma 引擎下载超时（ECONNRESET），使用国内镜像：

```cmd
set PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma
npm install
npm run setup
```

</details>

<details>
<summary><strong>LAN 局域网访问被阻止</strong></summary>

如果从局域网其他设备访问 `http://<你的IP>:3000` 时 HMR 连接被拒绝，需要在 `next.config.ts` 中添加你的局域网 IP：

```ts
// next.config.ts
allowedDevOrigins: ['192.168.x.x']
```

</details>

<details>
<summary><strong>首次登录提示 401</strong></summary>

确保已执行初始化步骤：浏览器访问 `http://localhost:3000/api/init`，看到成功提示后使用默认账户登录。

</details>

<details>
<summary><strong>AI 功能不可用 / 提示「未配置」</strong></summary>

1. 登录管理员账号，进入「个人中心」
2. 在「AI 助手配置」面板中完成配置（服务商、API 地址、API Key、模型名称）
3. 确认 API Key 有效且余额充足
4. 点击编辑器中的 AI 按钮测试是否正常工作

</details>

<details>
<summary><strong>同步 MD 按钮没有导入文件</strong></summary>

- 确认 `.md` 文件已放入项目根目录的 `content/` 文件夹（不是 `src/content/`）
- 确认 `.md` 文件包含 YAML frontmatter 且 `title` 字段不为空
- 如果 slug 已存在于数据库中，该文件会被跳过（不会覆盖）

</details>

<details>
<summary><strong>图片上传失败 / 图床不可用</strong></summary>

图片上传到本地 `public/uploads/` 目录，不依赖第三方图床。如果上传失败：

- 确认已登录管理员账号（只有管理员可以上传）
- 确认文件格式为 JPEG/PNG/WebP/GIF/BMP/TIFF/SVG/AVIF
- 确认文件大小不超过 10MB
- 确认 `public/uploads/` 目录存在且服务器有写入权限

</details>

---

## 部署

### 构建与运行

项目使用 `output: "standalone"` 模式，构建产物自包含：

```bash
npm run build
node .next/standalone/server.js
```

### 部署注意事项

- 部署时需将 `content/` 目录一并拷贝（包含 `.md` 文章文件）
- 部署时需将 `public/uploads/` 目录一并拷贝（包含本地图床图片）
- `prisma/` 目录需包含在部署包中（数据库初始化需要）
- `.env` 文件需包含 `JWT_SECRET` 配置

### Caddy 反向代理示例

```
blog.example.com {
    reverse_proxy localhost:3000
}
```

### Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name blog.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## License

[MIT](/LICENSE)
