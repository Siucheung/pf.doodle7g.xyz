/**
 * 通知渠道 API
 * GET  /api/notification-channels?org=:slug  - 获取组织下的所有通知渠道
 * POST /api/notification-channels             - 创建新的通知渠道
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidAppriseUrl } from '@/lib/apprise'

/**
 * 解析组织并校验用户是否为 owner/admin
 * 返回 { org, member } 或 NextResponse 错误
 */
async function resolveOrg(orgSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return { org, member, user, supabase }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')

    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    const ctx = await resolveOrg(orgSlug)
    if (!ctx) {
      return NextResponse.json({ error: '组织不存在或无权限' }, { status: 404 })
    }

    const { data: channels, error } = await ctx.supabase
      .from('notification_channels')
      .select('*')
      .eq('organization_id', ctx.org.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[NotificationChannels] 查询失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    return NextResponse.json(channels || [])
  } catch (error) {
    console.error('[NotificationChannels] GET 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, apprise_url, enabled, notify_on, orgSlug } = body

    if (!name || !type || !apprise_url || !orgSlug) {
      return NextResponse.json(
        { error: '缺少必填字段：name、type、apprise_url、orgSlug' },
        { status: 400 }
      )
    }

    // 验证 Apprise URL 格式
    if (!isValidAppriseUrl(apprise_url)) {
      return NextResponse.json(
        { error: 'Apprise URL 格式无效' },
        { status: 400 }
      )
    }

    // 解析组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    // 权限校验
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const { data: channel, error } = await supabase
      .from('notification_channels')
      .insert({
        organization_id: org.id,
        name,
        type,
        apprise_url,
        enabled: enabled !== false,
        notify_on: notify_on || [],
      })
      .select()
      .single()

    if (error) {
      console.error('[NotificationChannels] 创建失败:', error)
      return NextResponse.json({ error: '创建失败' }, { status: 500 })
    }

    return NextResponse.json(channel, { status: 201 })
  } catch (error) {
    console.error('[NotificationChannels] POST 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
