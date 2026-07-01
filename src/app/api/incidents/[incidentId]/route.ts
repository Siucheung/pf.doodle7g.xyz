/**
 * 事件详情 API
 * GET   /api/incidents/:incidentId - 获取单个事件
 * PATCH /api/incidents/:incidentId - 更新事件
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 允许的状态转换 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ['acknowledged', 'muted'],
  acknowledged: ['resolved', 'muted'],
  resolved: [],
  muted: [],
}

async function getIncidentAndCheckPermission(incidentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: incident } = await supabase
    .from('incidents')
    .select('*, organizations!inner(id, slug), projects!inner(name, slug), monitors(name)')
    .eq('id', incidentId)
    .single()

  if (!incident) return null

  // 校验成员身份
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', incident.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return { supabase, incident, member, user }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const ctx = await getIncidentAndCheckPermission(incidentId)
    if (!ctx) {
      return NextResponse.json({ error: '事件不存在或无权限' }, { status: 404 })
    }

    // 额外查询事件记录
    const { data: events } = await ctx.supabase
      .from('incident_events')
      .select('*, actor:profiles(full_name)')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ ...ctx.incident, events: events || [] })
  } catch (error) {
    console.error('[Incidents] GET 详情异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const ctx = await getIncidentAndCheckPermission(incidentId)
    if (!ctx) {
      return NextResponse.json({ error: '事件不存在或无权限' }, { status: 404 })
    }

    // PATCH 仅允许 owner/admin
    if (!['owner', 'admin'].includes(ctx.member.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.severity !== undefined) updates.severity = body.severity
    if (body.project_id !== undefined) updates.project_id = body.project_id
    if (body.monitor_id !== undefined) updates.monitor_id = body.monitor_id

    // 状态变更处理
    let previousStatus: string | null = null

    if (body.status !== undefined) {
      previousStatus = ctx.incident.status

      // 校验状态转换
      const allowed = ALLOWED_TRANSITIONS[previousStatus]
      if (!allowed || !allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `不允许从 ${previousStatus} 转换到 ${body.status}`,
            allowedTransitions: allowed || [],
          },
          { status: 400 }
        )
      }

      updates.status = body.status

      // 如果新状态为 resolved，自动设置 resolved_at
      if (body.status === 'resolved') {
        updates.resolved_at = new Date().toISOString()
      }
    }

    const { data: incident, error } = await ctx.supabase
      .from('incidents')
      .update(updates)
      .eq('id', incidentId)
      .select('*, projects!inner(name, slug), monitors(name)')
      .single()

    if (error) {
      console.error('[Incidents] 更新失败:', error)
      return NextResponse.json({ error: '更新失败' }, { status: 500 })
    }

    // 如果状态发生变化，自动写入事件记录
    if (body.status !== undefined && previousStatus !== null) {
      const { error: eventError } = await ctx.supabase
        .from('incident_events')
        .insert({
          incident_id: incidentId,
          event_type: 'status_change',
          old_value: previousStatus,
          new_value: body.status,
          actor_id: ctx.user.id,
        })

      if (eventError) {
        console.error('[Incidents] 创建状态变更事件记录失败:', eventError)
      }
    }

    return NextResponse.json(incident)
  } catch (error) {
    console.error('[Incidents] PATCH 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
