/**
 * 监控检查记录 API
 * GET /api/monitors/:monitorId/checks?limit=50 - 获取监控器最近检查记录
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    const { monitorId } = await params
    const url = new URL(_request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '60'), 200)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 验证监控器存在且属于当前用户可见的组织
    const { data: monitor } = await supabase
      .from('monitors')
      .select('id, name, organization_id')
      .eq('id', monitorId)
      .single()

    if (!monitor) {
      return NextResponse.json({ error: '监控器不存在' }, { status: 404 })
    }

    const { data: checks, error } = await supabase
      .from('monitor_checks')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('checked_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Monitor Checks] 查询失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    // 按时间升序返回（图表从左到右）
    return NextResponse.json((checks || []).reverse())

  } catch (error) {
    console.error('[Monitor Checks] GET 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
