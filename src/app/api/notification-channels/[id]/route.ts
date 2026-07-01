/**
 * 通知渠道详情 API
 * GET    /api/notification-channels/:id - 获取单个渠道
 * PUT    /api/notification-channels/:id - 更新渠道
 * DELETE /api/notification-channels/:id - 删除渠道
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidAppriseUrl } from '@/lib/apprise'

async function getChannelAndCheckPermission(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: channel } = await supabase
    .from('notification_channels')
    .select('*, organizations!inner(id, slug)')
    .eq('id', id)
    .single()

  if (!channel) return null

  // 校验权限
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', channel.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role)) return null

  return { supabase, channel, member, user }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getChannelAndCheckPermission(id)
    if (!ctx) {
      return NextResponse.json({ error: '渠道不存在或无权限' }, { status: 404 })
    }

    return NextResponse.json(ctx.channel)
  } catch (error) {
    console.error('[NotificationChannels] GET 详情异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getChannelAndCheckPermission(id)
    if (!ctx) {
      return NextResponse.json({ error: '渠道不存在或无权限' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.type !== undefined) updates.type = body.type
    if (body.apprise_url !== undefined) {
      if (!isValidAppriseUrl(body.apprise_url)) {
        return NextResponse.json({ error: 'Apprise URL 格式无效' }, { status: 400 })
      }
      updates.apprise_url = body.apprise_url
    }
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.notify_on !== undefined) updates.notify_on = body.notify_on

    const { data: channel, error } = await ctx.supabase
      .from('notification_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[NotificationChannels] 更新失败:', error)
      return NextResponse.json({ error: '更新失败' }, { status: 500 })
    }

    return NextResponse.json(channel)
  } catch (error) {
    console.error('[NotificationChannels] PUT 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getChannelAndCheckPermission(id)
    if (!ctx) {
      return NextResponse.json({ error: '渠道不存在或无权限' }, { status: 404 })
    }

    const { error } = await ctx.supabase
      .from('notification_channels')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[NotificationChannels] 删除失败:', error)
      return NextResponse.json({ error: '删除失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NotificationChannels] DELETE 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
