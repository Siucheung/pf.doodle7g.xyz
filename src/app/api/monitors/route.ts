/**
 * 监控 CRUD API
 * POST /api/monitors - 创建监控
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { name, url, method, expected_status, interval_seconds, project_id, organization_id } = body

    if (!name || !url || !expected_status || !interval_seconds || !organization_id) {
      return NextResponse.json(
        { error: '缺少必填字段：name, url, expected_status, interval_seconds, organization_id' },
        { status: 400 }
      )
    }

    // 验证用户是该组织的成员
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const { data: monitor, error } = await supabase
      .from('monitors')
      .insert({
        name,
        url,
        method: method || 'GET',
        expected_status: Number(expected_status),
        interval_seconds: Number(interval_seconds),
        project_id: project_id || null,
        organization_id,
        enabled: true,
      })
      .select('*, project:projects(name, slug)')
      .single()

    if (error) {
      console.error('[Monitors] 创建监控失败:', error)
      return NextResponse.json({ error: '创建监控失败' }, { status: 500 })
    }

    return NextResponse.json(monitor, { status: 201 })
  } catch (error) {
    console.error('[Monitors] POST 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
