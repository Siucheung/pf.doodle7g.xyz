/**
 * Vercel Deployment Webhook 接收路由
 *
 * 接收 Vercel 的部署事件，自动同步到 OpsPilot 的 deployments 表。
 * 实现"自举"（dogfooding）——OpsPilot 自身的 Vercel 部署也可监控。
 *
 * 配置方式（Vercel 侧）：
 *   项目设置 → Git → Webhooks → 添加端点：
 *     URL: https://<opspilot-domain>/api/webhooks/vercel
 *     事件: Deployment
 *     Secret: 与 VERCEL_WEBHOOK_SECRET 一致
 *
 * 安全性：
 *   - 通过 x-vercel-signature 头部验证请求来源
 *   - 使用 HMAC-SHA1 签名校验
 *
 * 项目映射方式（优先级）：
 *   1. 查找 projects.config->>'vercel_project_name' 匹配 Vercel 项目名
 *   2. 回退 SELF_DEPLOYMENT_PROJECT_ID 环境变量（OpsPilot 自身）
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

// ===== 类型定义 =====

/** Vercel Deployment Webhook 载荷 */
interface VercelDeploymentPayload {
  id: string
  name: string
  url: string
  meta: {
    githubCommitSha?: string
    githubCommitMessage?: string
    githubCommitRef?: string
    githubOrg?: string
    githubRepo?: string
  }
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'
  createdAt: number
  buildingAt: number | null
  readyAt: number | null
  target: string | null
}

// ===== 签名验证 =====

/**
 * 校验 Vercel Webhook 签名。
 * Vercel 使用 HMAC-SHA1 对请求体签名，
 * 通过 x-vercel-signature 头部传递。
 */
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET
  if (!secret || !signature) {
    if (!secret) {
      console.warn('[Vercel Webhook] VERCEL_WEBHOOK_SECRET 未配置，跳过签名验证')
    }
    return true
  }

  const expected = crypto
    .createHmac('sha1', secret)
    .update(payload)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    )
  } catch {
    return false
  }
}

// ===== 状态映射 =====

/**
 * 将 Vercel 部署状态映射为 OpsPilot deployments.status。
 */
function mapState(vercelState: string): string {
  const map: Record<string, string> = {
    BUILDING: 'building',
    READY: 'success',
    ERROR: 'failed',
    CANCELED: 'cancelled',
  }
  return map[vercelState] || vercelState.toLowerCase()
}

/**
 * 将 Vercel 部署目标映射为 OpsPilot deployments.environment。
 */
function mapTarget(target: string | null): string {
  if (target === 'production') return 'production'
  if (target === 'preview') return 'preview'
  return target || 'production'
}

// ===== 主处理逻辑 =====

export async function POST(request: Request) {
  try {
    // 读取原始请求体用于签名验证
    const rawBody = await request.text()
    const signature = request.headers.get('x-vercel-signature')

    // 验证签名
    if (!verifySignature(rawBody, signature)) {
      console.warn('[Vercel Webhook] 签名验证失败')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 解析载荷
    let payload: VercelDeploymentPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // 校验必要字段
    if (!payload.id || !payload.name || !payload.state) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, state' },
        { status: 400 }
      )
    }

    // 获取 Supabase 服务端凭证
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Vercel Webhook] 缺少 Supabase 环境变量')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ---- 查找对应的 OpsPilot 项目 ----
    let projectId: string | null = null
    let organizationId: string | null = null

    // 方式 1：通过 Vercel 项目名查找 project.config->>'vercel_project_name'
    const { data: projectsByConfig } = await supabase
      .from('projects')
      .select('id, organization_id')
      .filter('config->>vercel_project_name', 'eq', payload.name)
      .limit(1)

    if (projectsByConfig && projectsByConfig.length > 0) {
      projectId = projectsByConfig[0].id
      organizationId = projectsByConfig[0].organization_id
    }

    // 方式 2：回退 SELF_DEPLOYMENT_PROJECT_ID 环境变量
    if (!projectId) {
      const selfProjectId = process.env.SELF_DEPLOYMENT_PROJECT_ID
      if (selfProjectId) {
        const { data: selfProject } = await supabase
          .from('projects')
          .select('id, organization_id')
          .eq('id', selfProjectId)
          .single()

        if (selfProject) {
          projectId = selfProject.id
          organizationId = selfProject.organization_id
        }
      }
    }

    if (!projectId || !organizationId) {
      console.warn(
        `[Vercel Webhook] 未找到项目映射: ${payload.name}。` +
        '请在项目配置中设置 vercel_project_name，' +
        '或为自举部署设置 SELF_DEPLOYMENT_PROJECT_ID 环境变量。'
      )
      return NextResponse.json(
        { error: 'Project not found for Vercel project name' },
        { status: 404 }
      )
    }

    // ---- 计算部署耗时 ----
    let durationMs: number | null = null
    if (payload.buildingAt && payload.readyAt) {
      durationMs = payload.readyAt - payload.buildingAt
    } else if (payload.createdAt && payload.readyAt) {
      durationMs = payload.readyAt - payload.createdAt
    }

    // ---- 写入 deployments 表 ----
    const status = mapState(payload.state)
    const environment = mapTarget(payload.target)
    const commitSha = payload.meta.githubCommitSha || null
    const commitMessage = payload.meta.githubCommitMessage || null
    const branch = payload.meta.githubCommitRef || null

    const { error } = await supabase.from('deployments').insert({
      project_id: projectId,
      organization_id: organizationId,
      status,
      environment,
      commit_sha: commitSha,
      commit_message: commitMessage,
      branch,
      url: `https://${payload.url}`,
      duration_ms: durationMs,
      // 错误状态下存储错误信息
      error_message: payload.state === 'ERROR' ? `Deployment failed: ${payload.name}` : null,
    })

    if (error) {
      console.error('[Vercel Webhook] 写入部署记录失败:', error.message)
      return NextResponse.json({ error: 'Failed to save deployment' }, { status: 500 })
    }

    console.log(
      `[Vercel Webhook] 部署记录已同步: ${payload.name} → ${payload.state} (${environment})`
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Vercel Webhook] 处理失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
