/**
 * 告警管理 API
 * GET  /api/alerts?org=:slug  - 获取组织的告警记录列表
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')
    const status = searchParams.get('status') // firing | resolved
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    let query = supabase
      .from('alertmanager_alerts')
      .select('*, incident:incidents(title, status)')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error('[Alerts] 查询失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    return NextResponse.json(alerts || [])
  } catch (error) {
    console.error('[Alerts] GET 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
