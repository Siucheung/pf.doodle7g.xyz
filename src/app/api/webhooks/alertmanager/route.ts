/**
 * Alertmanager Webhook 接收路由
 *
 * Alertmanager 在告警状态变化时向此地址发送 POST 请求。
 * OpsPilot 将告警同步到 alertmanager_alerts 表，
 * 同时自动创建/更新 incidents 工单，并通过通知渠道发送通知。
 *
 * 配置方式（Alertmanager 侧）：
 *   receivers:
 *     - name: 'opspilot'
 *       webhook_configs:
 *         - url: 'https://<opspilot-domain>/api/webhooks/alertmanager?org=doodle7g'
 *           send_resolved: true
 *
 * 安全性：
 *   通过 ALERTMANAGER_WEBHOOK_SECRET 环境变量验证
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import type { AlertmanagerWebhookPayload } from '@/lib/alertmanager'
import {
  inferSeverity,
  extractTitle,
  extractDescription,
} from '@/lib/alertmanager'

// 验证 webhook 签名
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.ALERTMANAGER_WEBHOOK_SECRET
  if (!secret || !signature) {
    if (!secret) {
      console.warn('[Alertmanager Webhook] ALERTMANAGER_WEBHOOK_SECRET 未配置，跳过签名验证')
    }
    return true
  }

  const expected = crypto
    .createHmac('sha256', secret)
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

export async function POST(request: Request) {
  try {
    // 读取 org 参数（从 URL 查询参数）
    const url = new URL(request.url)
    const orgSlug = url.searchParams.get('org')
    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    // 读取原始请求体
    const rawBody = await request.text()
    const signature = request.headers.get('x-alertmanager-signature')

    // 签名验证
    if (!verifySignature(rawBody, signature)) {
      console.warn('[Alertmanager Webhook] 签名验证失败')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 解析载荷
    let payload: AlertmanagerWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // 获取 Supabase 服务端凭证
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Alertmanager Webhook] 缺少 Supabase 环境变量')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
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

    const organizationId = org.id
    const results: Array<{ fingerprint: string; action: string }> = []

    // 逐条处理告警
    for (const alert of payload.alerts) {
      const severity = inferSeverity(alert.labels)
      const title = extractTitle(alert.labels, alert.annotations)
      const description = extractDescription(alert.annotations)

      // 查询指纹是否已存在（upsert 逻辑）
      const { data: existing } = await supabase
        .from('alertmanager_alerts')
        .select('id, incident_id, status')
        .eq('organization_id', organizationId)
        .eq('fingerprint', alert.fingerprint)
        .single()

      if (existing) {
        // 更新已有告警
        const { error: updateErr } = await supabase
          .from('alertmanager_alerts')
          .update({
            status: alert.status,
            ends_at: alert.endsAt === '0001-01-01T00:00:00Z' ? null : alert.endsAt,
            labels: alert.labels,
            annotations: alert.annotations,
            severity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateErr) {
          console.error(`[Alertmanager Webhook] 更新告警失败 (${alert.fingerprint}):`, updateErr)
          continue
        }

        // 如果告警已解决，也关闭关联的工单
        if (
          alert.status === 'resolved' &&
          existing.incident_id &&
          existing.status !== 'resolved'
        ) {
          await supabase
            .from('incidents')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
            })
            .eq('id', existing.incident_id)
        }

        results.push({ fingerprint: alert.fingerprint, action: 'updated' })
      } else {
        // 创建新告警记录关联到新的或已有的工单

        // 查找是否有该 alertname 的活跃工单
        const alertname = alert.labels.alertname || 'unknown'
        const { data: openIncidents } = await supabase
          .from('incidents')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('status', 'open')
          .ilike('title', `%${alertname}%`)
          .limit(1)

        let incidentId: string | null = null

        if (openIncidents && openIncidents.length > 0) {
          // 关联到已有工单
          incidentId = openIncidents[0].id
        } else if (alert.status === 'firing') {
          // 创建新工单
          const { data: newIncident, error: incidentErr } = await supabase
            .from('incidents')
            .insert({
              organization_id: organizationId,
              title,
              description: description || `Alertmanager 告警: ${title}`,
              severity,
              status: 'open',
            })
            .select('id')
            .single()

          if (!incidentErr && newIncident) {
            incidentId = newIncident.id
          }
        }

        // 插入告警记录
        const { error: insertErr } = await supabase
          .from('alertmanager_alerts')
          .insert({
            organization_id: organizationId,
            fingerprint: alert.fingerprint,
            status: alert.status,
            labels: alert.labels,
            annotations: alert.annotations,
            starts_at: alert.startsAt,
            ends_at: alert.endsAt === '0001-01-01T00:00:00Z' ? null : alert.endsAt,
            generator_url: alert.generatorURL,
            severity,
            incident_id: incidentId,
          })

        if (insertErr) {
          console.error(`[Alertmanager Webhook] 插入告警失败 (${alert.fingerprint}):`, insertErr)
          continue
        }

        results.push({ fingerprint: alert.fingerprint, action: 'created' })
      }
    }

    console.log(
      `[Alertmanager Webhook] 已处理 ${results.length} 条告警: ` +
      `${results.filter(r => r.action === 'created').length} 新建, ` +
      `${results.filter(r => r.action === 'updated').length} 更新`
    )

    return NextResponse.json({ received: true, results })
  } catch (error) {
    console.error('[Alertmanager Webhook] 处理失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
