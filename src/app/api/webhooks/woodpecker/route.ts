/**
 * Woodpecker CI Webhook 接收路由
 *
 * Woodpecker 在流水线状态变化时向此地址发送 POST 请求。
 * OpsPilot 将流水线状态同步到 ci_pipelines 表，并在必要时
 * 触发部署记录或其他工作流。
 *
 * 配置方式（Woodpecker 端）：
 *   WOODPECKER_WEBHOOK_SECRET=<共享密钥>
 *   WOODPECKER_WEBHOOK_HOST=http://opspilot:3000/api/webhooks/woodpecker
 *
 * 安全性：
 *   - 通过 X-Woodpecker-Signature 头部验证请求来源
 *   - 使用 HMAC-SHA256 签名校验
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import {
  handleWoodpeckerWebhook,
  type WoodpeckerWebhookPayload,
} from '@/lib/woodpecker'

/**
 * 校验 Woodpecker Webhook 签名。
 * Woodpecker 使用 HMAC-SHA256 对请求体签名，
 * 通过 X-Woodpecker-Signature 头部传递。
 */
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.WOODPECKER_WEBHOOK_SECRET
  if (!secret || !signature) {
    // 未配置签名验证时记录警告但仍继续
    if (!secret) {
      console.warn('[Webhook] WOODPECKER_WEBHOOK_SECRET 未配置，跳过签名验证')
    }
    return true
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // 使用 timing-safe 比较防止时序攻击
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // 读取原始请求体用于签名验证
    const rawBody = await request.text()
    const signature = request.headers.get('x-woodpecker-signature')

    // 验证签名
    if (!verifySignature(rawBody, signature)) {
      console.warn('[Webhook] 签名验证失败')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 解析 Webhook 载荷
    let payload: WoodpeckerWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // 校验必要字段
    if (!payload.repo?.full_name || !payload.pipeline?.number) {
      return NextResponse.json(
        { error: 'Invalid payload: missing repo.full_name or pipeline.number' },
        { status: 400 }
      )
    }

    // 获取 Supabase 服务端凭证
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Webhook] 缺少 Supabase 环境变量')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // 同步流水线状态到数据库
    await handleWoodpeckerWebhook(payload, supabaseUrl, supabaseKey)

    console.log(
      `[Webhook] 流水线同步成功: ${payload.repo.full_name}#${payload.pipeline.number} → ${payload.pipeline.status}`
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] 处理失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
