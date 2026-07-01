/**
 * 日志种子数据 API
 * POST /api/logs/seed?org=:slug — 为指定组织插入示例日志数据
 *
 * 安全：需要登录 + 使用 Service Role 跳过 RLS
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

const LOG_LEVELS = ['info', 'warn', 'error', 'debug'] as const
const LOG_SOURCES = ['build', 'runtime', 'edge', 'function'] as const

interface SeedLogEntry {
  project_id: string | null
  organization_id: string
  level: string
  message: string
  source: string
  metadata: Record<string, unknown>
  created_at: string
}

// 逼真的日志消息模板
const MESSAGE_TEMPLATES: Record<string, string[]> = {
  build: [
    '[esbuild] Bundling {count} modules for {target}...',
    '[esbuild] Build completed in {duration}ms ({size}KB gzipped)',
    '[next] ✓ Compiled successfully in {duration}ms',
    '[next] Generating static pages ({done}/{total})',
    '[turbopack] Loaded {count} client modules from chunk [{chunk}]',
    '[swc] Transpiled {target}: {duration}ms ({lines} lines)',
    '[webpack] Asset {name}.{hash}.js rewritten to {count} bytes',
    '[postcss] Processed {file} → {file_out} ({duration}ms)',
    '[tailwind] Generated {count} utility classes in {duration}ms',
    '[tsc] Type checking passed ({files} files, {errors} errors)',
  ],
  runtime: [
    'GET {path} — {status} {duration}ms',
    'POST {path} — {status} {duration}ms',
    'PUT {path} — {status} {duration}ms',
    'DELETE {path} — {status} {duration}ms',
    'Middleware: {name} executed in {duration}ms',
    'Server Action: {name} called from {source}',
    'Route handler: {path} responded {status}',
    'Cache MISS for {key} ({duration}ms to populate)',
    'Revalidating path: {path} (token: {token})',
    'Updating session for user {userId}',
  ],
  edge: [
    '[edge] Request {method} {path} — {status} ({duration}ms)',
    '[edge] Geo match: {country} → region {region}',
    '[edge] Edge Function {name} invoked from {ip}',
    '[edge] Cache HIT for {path} (TTL: {ttl}s remaining)',
    '[edge] Rewriting {from} → {to}',
    '[edge] Rate limit exceeded for IP {ip} (reset in {reset}s)',
    '[edge] Bot detected: {userAgent} — blocked',
    '[edge] A/B test: variant {variant} assigned to session {session}',
    '[edge] Auth check passed for {userId} on {path}',
    '[edge] Redirecting {from} → {to} ({status})',
  ],
  function: [
    'Function {name} started (memory: {memory}MB, timeout: {timeout}s)',
    'Function {name} completed in {duration}ms ({memory}MB used)',
    'Function {name} failed: {error} (exit code: {code})',
    'DB Query: SELECT {fields} FROM {table} WHERE {condition} — {duration}ms ({rows} rows)',
    'DB Query: INSERT INTO {table} ({fields}) — {duration}ms',
    'DB Query: UPDATE {table} SET {fields} WHERE {condition} — {duration}ms ({rows} affected)',
    'External API: {method} {url} — {status} ({duration}ms)',
    'External API: timeout after {timeout}ms calling {url}',
    'Queue: {task} processed (attempt {n}/{max})',
    'Cron: {job} started at {time}',
    'Cron: {job} completed ({items} items processed, {errors} errors)',
    'Webhook received: {source} — event {event} ({duration}ms)',
    'Cache SET {key} ({size} bytes, TTL: {ttl}s)',
    'Cache GET {key} — {hit ? "HIT" : "MISS"}',
    'Auth: {action} for user {userId} ({provider})',
  ],
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randVars(): Record<string, string | number | boolean> {
  return {
    count: randomInt(1, 500),
    target: randomItem(['client', 'server', 'edge', 'default']),
    duration: randomInt(10, 12000),
    size: randomInt(5, 800),
    done: randomInt(1, 50),
    total: 50,
    chunk: randomItem(['main', 'vendor', 'chunk-1234', 'pages']),
    lines: randomInt(100, 5000),
    // `name` used by both build and function templates
    name: randomItem(['main', 'vendor', 'runtime', 'framework', 'sendEmail', 'processPayment', 'syncData', 'backupDB', 'generateReport', 'checkHealth', 'deployService']),
    hash: randomItem(['a1b2c3', 'd4e5f6', 'g7h8i9']),
    file: randomItem(['styles.css', 'app.tsx', 'layout.tsx', 'page.tsx']),
    file_out: randomItem(['styles.css', 'app.js', 'bundle.js']),
    path: randomItem(['/api/orgs', '/api/projects', '/api/deployments', '/api/incidents', '/api/projects/new', '/dashboard', '/login', '/api/webhooks/vercel', '/api/webhooks/woodpecker', '/api/alerts']),
    status: randomItem(['200', '201', '204', '301', '304', '400', '401', '403', '404', '500', '502']),
    // `source` used by both runtime and webhook templates
    source: randomItem(['dashboard', 'cli', 'webhook', 'cron', 'api', 'github', 'woodpecker', 'vercel', 'alertmanager', 'gatus']),
    key: randomItem(['user:123', 'session:abc', 'org:456', 'projects:list', 'config:site']),
    token: randomItem(['reval-abc', 'reval-def', 'reval-ghi']),
    userId: randomItem(['u_abc123', 'u_def456', 'u_ghi789']),
    method: randomItem(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    country: randomItem(['US', 'CN', 'JP', 'DE', 'UK', 'BR']),
    region: randomItem(['us-east-1', 'cn-north-1', 'ap-northeast-1', 'eu-west-1']),
    ip: randomItem(['192.168.1.100', '10.0.0.50', '203.0.113.42', '198.51.100.7']),
    ttl: randomInt(30, 3600),
    from: randomItem(['/old-path', '/deprecated', '/legacy']),
    to: randomItem(['/new-path', '/current', '/v2']),
    reset: randomInt(10, 300),
    userAgent: randomItem(['curl/8.0', 'Go-http-client', 'python-requests', 'Mozilla/5.0 (compatible; Googlebot)']),
    variant: randomItem(['A', 'B']),
    session: randomItem(['sess_abc', 'sess_def', 'sess_ghi']),
    memory: randomInt(64, 1024),
    timeout: randomInt(10, 300),
    error: randomItem(['ETIMEOUT', 'ECONNREFUSED', 'ECONNRESET', 'ERANGE', 'TypeError: Cannot read property', 'Error: rate limit exceeded']),
    code: randomItem(['1', '2', '127', '137', '139', '255']),
    rows: randomInt(0, 1000),
    url: randomItem(['https://api.github.com/repos/org/repo', 'https://woodpecker.example.com/api/pipelines', 'https://infisical.example.com/api/v1/secrets', 'https://apprise.example.com/notify']),
    task: randomItem(['sync-repos', 'cleanup-logs', 'rotate-secrets', 'update-monitors']),
    n: randomInt(1, 5),
    max: 5,
    job: randomItem(['daily-backup', 'health-check', 'metric-collect', 'session-cleanup']),
    time: new Date().toISOString().slice(11, 19),
    items: randomInt(10, 5000),
    errors: randomInt(0, 50),
    event: randomItem(['push', 'pull_request', 'deployment', 'alert', 'status_change']),
    bytes: randomInt(100, 50000),
    action: randomItem(['sign_in', 'sign_up', 'sign_out', 'password_reset', 'oauth_callback']),
    provider: randomItem(['github', 'google', 'email']),
    // `fields` used by multiple DB query templates
    fields: randomItem(['*', 'id,name,email', 'id,status,created_at', 'count(*)', 'name,slug', 'status,updated_at', 'severity,assigned_to']),
    // `table` used by multiple DB query templates
    table: randomItem(['projects', 'deployments', 'monitors', 'incidents', 'logs', 'organizations', 'profiles', 'ci_pipelines', 'forge_repos']),
    // `condition` used by multiple DB query templates
    condition: randomItem(['id = $1', 'organization_id = $1', 'deleted_at IS NULL', 'status = $1 AND created_at > $2']),
  }
}

function fillTemplate(template: string): string {
  const vars = randVars()

  return template.replace(/\{(\w+(?:\s*\?\s*"[^"]*"\s*:\s*"[^"]*")?)\}/g, (_, key) => {
    // Handle ternary expressions like {hit ? "HIT" : "MISS"}
    const ternary = key.match(/(\w+)\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/)
    if (ternary) {
      const val = vars[ternary[1] as keyof typeof vars]
      return val ? ternary[2] : ternary[3]
    }
    const val = vars[key as keyof typeof vars]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

function generateLogs(
  orgId: string,
  projectIds: string[],
  count: number
): SeedLogEntry[] {
  const logs: SeedLogEntry[] = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    // 时间分布：大部分在最近2小时，少数在24h内
    const minutesAgo = Math.random() < 0.6
      ? Math.random() * 120
      : 120 + Math.random() * (1440 - 120)

    const level = randomItem(LOG_LEVELS)
    const levelMsgTemplates = MESSAGE_TEMPLATES['function'] // default
    const source = randomItem(LOG_SOURCES)
    const template = randomItem(MESSAGE_TEMPLATES[source] || levelMsgTemplates)
    const isError = level === 'error' ? Math.random() < 0.7 : false
    const actualLevel = isError ? 'error' : level

    logs.push({
      project_id: randomItem(projectIds),
      organization_id: orgId,
      level: actualLevel,
      message: fillTemplate(template),
      source,
      metadata: {
        simulated: true,
        seed_batch: '20240703',
      },
      created_at: new Date(now - minutesAgo * 60 * 1000).toISOString(),
    })
  }

  return logs
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')

    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    // 验证登录
    const userClient = await createUserClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 使用 Service Role 客户端绕过 RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: '缺少 Service Role 配置' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 查找组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    // 查找项目
    // 确保有项目可用（logs 表 project_id 有 NOT NULL 约束）
    let { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', org.id)

    if (!projects || projects.length === 0) {
      const { data: newProject } = await supabase
        .from('projects')
        .insert({
          organization_id: org.id,
          name: 'Demo Project',
          slug: 'demo-project',
          description: '自动创建的演示项目',
        })
        .select('id')
        .single()
      if (newProject) projects = [newProject]
    }

    const projectIds = (projects || []).map((p) => p.id)

    // 生成种子日志
    const batchSize = 200
    const logs = generateLogs(org.id, projectIds, batchSize)

    // 分批插入（PostgreSQL 限制）
    const CHUNK_SIZE = 50
    let inserted = 0
    for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
      const chunk = logs.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('logs').insert(chunk)
      if (error) {
        console.error('[Seed] 插入失败:', error)
        return NextResponse.json(
          { error: `插入失败: ${error.message}`, inserted },
          { status: 500 }
        )
      }
      inserted += chunk.length
    }

    return NextResponse.json({
      success: true,
      inserted,
      org: orgSlug,
      projects: projectIds.length,
      note: '这些是演示种子数据，可在日志页面查看',
    })
  } catch (error) {
    console.error('[Seed] 异常:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}
