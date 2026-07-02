/**
 * 监控器详情 API
 * GET   /api/monitors/:monitorId - 获取单个监控器
 * PATCH /api/monitors/:monitorId - 更新监控器
 * DELETE /api/monitors/:monitorId - 删除监控器
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getMonitorAndCheckPermission(monitorId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: monitor } = await supabase
    .from('monitors')
    .select('*, project:projects(name, slug)')
    .eq('id', monitorId)
    .single()

  if (!monitor) return null

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', (monitor as Record<string, unknown>).organization_id as string)
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return { supabase, monitor, member, user }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    const { monitorId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: monitor } = await supabase
      .from('monitors')
      .select('*, project:projects(name, slug)')
      .eq('id', monitorId)
      .single()

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', (monitor as Record<string, unknown>).organization_id as string)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(monitor)
  } catch (error) {
    console.error('[Monitors] GET 异常:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    const { monitorId } = await params
    const ctx = await getMonitorAndCheckPermission(monitorId)
    if (!ctx) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    if (!['owner', 'admin'].includes(ctx.member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.url !== undefined) updates.url = body.url
    if (body.method !== undefined) updates.method = body.method
    if (body.expected_status !== undefined) updates.expected_status = Number(body.expected_status)
    if (body.interval_seconds !== undefined) updates.interval_seconds = Number(body.interval_seconds)
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.project_id !== undefined) updates.project_id = body.project_id || null

    const { data: monitor, error } = await ctx.supabase
      .from('monitors')
      .update(updates)
      .eq('id', monitorId)
      .select('*, project:projects(name, slug)')
      .single()

    if (error) {
      console.error('[Monitors] 更新失败:', error)
      return NextResponse.json({ error: 'Failed to update monitor' }, { status: 500 })
    }

    return NextResponse.json(monitor)
  } catch (error) {
    console.error('[Monitors] PATCH 异常:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    const { monitorId } = await params
    const ctx = await getMonitorAndCheckPermission(monitorId)
    if (!ctx) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    if (!['owner', 'admin'].includes(ctx.member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await ctx.supabase
      .from('monitors')
      .delete()
      .eq('id', monitorId)

    if (error) {
      console.error('[Monitors] 删除失败:', error)
      return NextResponse.json({ error: 'Failed to delete monitor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Monitors] DELETE 异常:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
