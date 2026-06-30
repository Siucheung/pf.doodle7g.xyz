# OpsPilot - Supabase 配置指南

## 1. 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册/登录账号
3. 点击 "New Project"
4. 填写项目信息：
   - Name: `opspilot` (或任意名称)
   - Database Password: 保存好这个密码
   - Region: 选择离你最近的区域（推荐 `East Asia` 或 `Southeast Asia`）
5. 点击 "Create new project"
6. 等待 2-3 分钟，项目初始化完成

## 2. 获取 API 凭证

1. 进入项目 Dashboard
2. 点击左侧 "Settings" → "API"
3. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

## 3. 配置本地环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_SECRET=your-webhook-secret-here
```

## 4. 执行数据库迁移

### 方法 1: 通过 Supabase Dashboard（推荐新手）

1. 进入 Supabase Dashboard
2. 点击左侧 "SQL Editor"
3. 点击 "New query"
4. 复制 `supabase/schema.sql` 的全部内容并粘贴
5. 点击 "Run" 执行
6. 重复步骤 3-5，执行 `supabase/rls-policies.sql`

### 方法 2: 通过 Supabase CLI（推荐生产环境）

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 初始化本地项目
supabase init

# 链接到远程项目
supabase link --project-ref your-project-id

# 执行迁移
supabase db push
```

## 5. 启用 Realtime

1. 进入 Supabase Dashboard
2. 点击 "Database" → "Replication"
3. 启用以下表的 Realtime：
   - ✅ deployments
   - ✅ monitor_checks
   - ✅ incidents
   - ✅ incident_events

## 6. 配置 GitHub OAuth（可选）

1. 进入 Supabase Dashboard → "Authentication" → "Providers"
2. 找到 "GitHub" 并启用
3. 在 GitHub 创建 OAuth App：
   - 访问 https://github.com/settings/developers
   - 点击 "New OAuth App"
   - Application name: `OpsPilot`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `https://your-project-id.supabase.co/auth/v1/callback`
4. 复制 GitHub Client ID 和 Client Secret 到 Supabase

## 7. 生成 TypeScript 类型

```bash
# 安装 Supabase CLI
npm install -g supabase

# 生成类型
npx supabase gen types typescript --project-id your-project-id > src/types/database.types.ts
```

## 8. 启动应用

```bash
# 安装依赖（如果还没安装）
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000，你应该能看到登录页面。

## 9. 测试流程

1. 访问 http://localhost:3000/signup
2. 注册一个新账号（或使用 GitHub OAuth）
3. 登录后会自动重定向到 `/dashboard`
4. 你可以开始创建项目、部署等

## 10. 部署到 Vercel

1. 推送代码到 GitHub
2. 访问 https://vercel.com
3. 导入你的 GitHub 仓库
4. 在 Vercel Dashboard 配置环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (你的 Vercel 域名)
   - `WEBHOOK_SECRET`
5. 点击 "Deploy"

## 常见问题

### Q: 登录后提示 "Organization not found"
A: 这是正常的。你需要在注册后手动创建一个组织，或者我们在后续版本中添加组织创建流程。

### Q: RLS 策略阻止了查询
A: 确保你已经执行了 `rls-policies.sql`，并且用户已经接受了组织邀请（`accepted_at` 不为 null）。

### Q: Realtime 不工作
A: 检查 Supabase Dashboard → Database → Replication，确保相关表已启用 Realtime。
