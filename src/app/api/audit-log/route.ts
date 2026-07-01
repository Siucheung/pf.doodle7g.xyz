// ============================================================
// 审计日志查询 API
// GET /api/audit-log?org=:slug&table=:tableName&operation=:op&limit=50&offset=0
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')
    const tableName = searchParams.get('table')
    const operation = searchParams.get('operation')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    const supabase = await createClient()

    // 验证用户权限
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 获取组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    // 验证用户是否属于该组织
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    // 构建查询
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (tableName) {
      query = query.eq('table_name', tableName)
    }
    if (operation) {
      query = query.eq('operation', operation)
    }

    const { data: logs, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs, total: count, limit, offset })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询审计日志失败' },
      { status: 500 }
    )
  }
}
