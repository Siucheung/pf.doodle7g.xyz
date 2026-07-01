
# OpsPilot

**OpsPilot** 是一个全栈软件运维平台，将项目管理、CI/CD 流水线、监控、日志、密钥管理、工单、告警和团队协作整合到同一界面下，并支持多租户组织隔离。

作为传统分散运维工具的现代化替代方案，它展示了端到端的全栈工程能力，专注于真实世界的 DevOps 工作流。

## 功能特性

| 模块 | 描述 | 集成 |
|------|------|------|
| **组织** | 多租户工作空间，基于角色的访问控制（owner / admin / member / viewer） | Supabase RLS |
| **项目** | 管理软件项目及元数据设置 | Supabase |
| **CI/CD 流水线** | 查看、运行和取消项目流水线 | Woodpecker CI + Gitea |
| **部署** | 追踪部署历史与状态 | Vercel webhook、Render |
| **监控** | 服务健康看板与在线状态 | Gatus |
| **日志** | 集中式日志查看器 | Supabase |
| **密钥** | 跨项目存储和管理环境变量 | Infisical（加密存储） |
| **审计日志** | 不可篡改的操作审计追踪 | Supabase + 审计触发器 |
| **工单** | 问题追踪与工单管理 | Supabase |
| **告警** | 来自监控系统的实时告警流 | Alertmanager webhook |
| **通知** | 多渠道通知路由 | Apprise（邮件、Slack、Telegram 等） |
| **团队** | 邀请成员并管理组织内角色 | Supabase |
| **备份** | 自动化数据库备份调度 | WAL‑G |

## 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | [Next.js 16](https://nextjs.org/)（App Router、Turbopack、React 19） |
| **语言** | TypeScript |
| **数据库** | [Supabase](https://supabase.com/)（PostgreSQL + RLS + Auth） |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) nova + [@base-ui/react](https://base-ui.com/) |
| **样式** | Tailwind CSS v4 |
| **国际化** | next-intl（中文 / English） |
| **认证** | Supabase Auth（邮箱密码 + GitHub OAuth） |
| **密钥管理** | Infisical（自托管，AES‑256‑GCM 加密存储） |
| **CI** | Woodpecker CI |
| **代码托管** | Gitea |
| **通知** | Apprise |
| **监控** | Gatus、Alertmanager |
| **图表** | Recharts |
| **动画** | tw-animate-css |
| **部署** | Vercel / Render |

## 架构

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js 16 App                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 仪表板    │ │ 项目     │ │ CI/CD    │ │ 设置     │   │
│  │ 概览      │ │ +密钥    │ │ +部署    │ │ +团队    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 监控     │ │ 日志     │ │ 告警     │ │ 工单     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├──────────────────────────────────────────────────────────┤
│  API 路由（webhook、数据 API、认证回调）                   │
├──────────────────────────────────────────────────────────┤
│  Supabase Client（Auth + PostgreSQL + RLS）              │
└──────────────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │Supabase │   │Infisical│   │外部服务  │
    │PostgreSQL│  │密钥管理  │   │(CI/Git/ │
    │+ Auth   │   │         │   │监控)    │
    │+ RLS    │   │         │   │         │
    └─────────┘   └─────────┘   └─────────┘
```

## 快速开始

### 前置要求

- Node.js ≥ 20
- pnpm / npm / yarn
- Supabase 项目（云端或本地）
- Docker（可选，用于自托管服务）

### 环境变量

复制 `.env.example` 为 `.env.local` 并填入你的配置：

```bash
cp .env.example .env.local
```

关键变量：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 API 密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥（服务端使用） |

### 数据库安装

通过 Supabase SQL Editor 按顺序执行以下 SQL 文件：

1. `supabase/schema.sql` — 表、索引、触发器、函数
2. `supabase/migrations/*.sql` — 功能迁移
3. `supabase/rls-policies.sql` — 行级安全策略

所有 SQL 均为幂等设计——重复执行安全。

### 安装与运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 演示账号

登录页已预填演示账号，直接点击 **登录** 即可开始体验：

- **邮箱：** `seancheung.letter@qq.com`
- **密码：** `RZnAO%7hz&a3v6`

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── (auth)/             # 登录、注册、密码重置
│   ├── (dashboard)/        # 仪表板布局路由（组织作用域）
│   ├── dashboard/          # 组织选择器概览
│   ├── api/                # API 路由处理与 webhook
│   └── auth/               # 认证回调路由
├── components/
│   ├── auth/               # 认证表单（登录/注册）
│   ├── dashboard/          # 侧栏、顶栏
│   ├── settings/           # 设置弹窗
│   └── ui/                 # shadcn/ui 基础组件
├── lib/
│   ├── services/           # 业务逻辑服务
│   ├── supabase/           # Supabase 客户端实例
│   ├── constants.ts        # 侧栏导航配置
│   ├── encryption.ts       # AES‑256‑GCM 加密
│   ├── infisical.ts        # Infisical API 客户端
│   ├── woodpecker.ts       # Woodpecker CI 客户端
│   ├── gitea.ts            # Gitea API 客户端
│   ├── apprise.ts          # Apprise 通知客户端
│   └── alertmanager.ts     # Alertmanager webhook 解析
├── messages/               # 国际化翻译（zh‑CN / en）
└── types/                  # 共享 TypeScript 类型

supabase/
├── schema.sql              # 完整数据库 schema
├── migrations/*.sql        # 功能迁移
└── rls-policies.sql        # 行级安全策略
```

## 关键集成

### CI/CD 流水线 — Woodpecker + Gitea

OpsPilot 通过 **Gitea** 管理 Git 仓库，通过 **Woodpecker** 管理 CI 流水线。首次设置时平台自动创建 OAuth 应用，用户无需离开仪表板即可触发和监控构建。

### 密钥管理 — Infisical

密钥存储在自托管的 **Infisical** 实例中。OpsPilot 使用 **AES‑256‑GCM** 加密存储 Infisical 服务凭证，并按项目自动同步环境变量。

### 统一通知 — Apprise

所有通知——流水线状态、告警、部署事件——均通过 **Apprise** 路由，支持数十种渠道（邮件、Slack、Discord、Telegram、Pushover 等）。

### 监控 — Gatus + Alertmanager

服务健康通过 **Gatus** 追踪。来自 **Prometheus Alertmanager** 的告警通过 webhook 接入并展示在告警流中。

### Webhook 驱动部署

OpsPilot 接收来自 **Vercel** 和 **Render** 的部署 webhook，自动更新项目部署状态并触发通知。

## 数据库

PostgreSQL 数据库包含 14 张表、行级安全策略、审计触发器和完整的幂等迁移：

- **组织** — 多租户工作空间隔离
- **项目** — 按组织管理项目
- **密钥 / Infisical 凭证** — 加密凭证存储
- **工单** — 带状态流转的问题追踪
- **审计日志** — 通过触发器实现的不可变变更历史
- **Alertmanager 告警** — 接入的告警事件流
- **通知渠道** — 按组织的通知路由配置

## 脚本

```bash
npm run dev       # 开发服务器（Turbopack）
npm run build     # 生产构建
npm run start     # 生产启动
npm run lint      # ESLint
```

## 部署

OpsPilot 设计部署在 **Vercel** 或 **Render**。首次部署前需要执行数据库迁移。

### Vercel

```bash
npm run build
vercel deploy
```

平台同时通过 Vercel webhook 监控自身部署状态（自举运维）。

## 许可证

MIT

---

*基于 Next.js 16、Supabase 和 shadcn/ui 构建。*
