/**
 * 测试通知渠道
 * POST /api/notification-channels/:id/test
 *
 * 向指定渠道发送测试消息，验证 Apprise URL 配置是否正确
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify, healthCheck } from '@/lib/apprise'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 查询渠道
    const { data: channel } = await supabase
      .from('notification_channels')
      .select('*, organizations!inner(id, slug)')
      .eq('id', id)
      .single()

    if (!channel) {
      return NextResponse.json({ error: '渠道不存在' }, { status: 404 })
    }

    // 权限校验
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', channel.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    // 检查 Apprise 服务是否在线
    const isHealthy = await healthCheck()
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Apprise 通知服务未就绪，请确认 docker 容器 apprise 正在运行' },
        { status: 503 }
      )
    }

    // 发送测试消息
    const result = await notify({
      title: `[测试] ${channel.name}`,
      body: '这是一条来自 OpsPilot 的测试通知。如果你的应用版本支持 Markdown，**恭喜你，配置正确！** 🎉',
      type: 'info',
      urls: [channel.apprise_url],
    })

    return NextResponse.json({
      success: result.status === 'posted',
      status: result.status,
      sent_count: result.sent_count,
      error_count: result.error_count,
    })
  } catch (error) {
    console.error('[NotificationChannels] 测试发送异常:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '测试发送失败' },
      { status: 500 }
    )
  }
}
