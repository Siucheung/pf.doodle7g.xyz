/**
 * 事件记录 API
 * POST /api/incidents/:incidentId/events - 添加事件记录/评论
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_EVENT_TYPES = ['status_change', 'comment', 'assignment', 'trigger']

async function getIncidentAndCheckMember(incidentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: incident } = await supabase
    .from('incidents')
    .select('*, organizations!inner(id, slug)')
    .eq('id', incidentId)
    .single()

  if (!incident) return null

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', incident.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return { supabase, incident, member, user }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const { incidentId } = await params
    const ctx = await getIncidentAndCheckMember(incidentId)
    if (!ctx) {
      return NextResponse.json({ error: '事件不存在或无权限' }, { status: 404 })
    }

    const body = await request.json()
    const { event_type, old_value, new_value, comment } = body

    if (!event_type) {
      return NextResponse.json({ error: '缺少必填字段：event_type' }, { status: 400 })
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json(
        { error: `无效的 event_type，可选值：${VALID_EVENT_TYPES.join('、')}` },
        { status: 400 }
      )
    }

    // 对于 comment 类型，将 comment 内容存入 new_value
    let finalNewValue = new_value ?? null
    if (event_type === 'comment' && comment !== undefined) {
      finalNewValue = comment
    }

    const { data: event, error } = await ctx.supabase
      .from('incident_events')
      .insert({
        incident_id: incidentId,
        event_type,
        old_value: old_value ?? null,
        new_value: finalNewValue,
        actor_id: ctx.user.id,
      })
      .select('*, actor:profiles(full_name)')
      .single()

    if (error) {
      console.error('[Incidents] 创建事件记录失败:', error)
      return NextResponse.json({ 
        error: '创建事件记录失败', 
        detail: error.message,
        code: error.code 
      }, { status: 500 })
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('[Incidents] POST 事件记录异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
