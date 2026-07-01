/**
 * 事件管理 API
 * GET  /api/incidents?org=:slug  - 获取组织的事件列表
 * POST /api/incidents             - 创建新事件
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!orgSlug) {
      return NextResponse.json({ error: '缺少 org 参数' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
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

    // 校验成员身份（任何成员均可读取）
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    let query = supabase
      .from('incidents')
      .select('*, projects!inner(name, slug), monitors(name)')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (search) {
      query = query.ilike('title', `%${search}%`)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error('[Incidents] 查询失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    return NextResponse.json(incidents || [])
  } catch (error) {
    console.error('[Incidents] GET 异常:', error)
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
    const { title, description, severity, project_id, organization_id, monitor_id } = body

    if (!title || !severity || !project_id) {
      return NextResponse.json(
        { error: '缺少必填字段：title、severity、project_id' },
        { status: 400 }
      )
    }

    // 确定组织 ID
    let orgId = organization_id

    if (!orgId) {
      // 尝试从 project_id 解析
      const { data: project } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', project_id)
        .single()

      if (project) {
        orgId = project.organization_id
      }
    }

    if (!orgId) {
      // 从用户的首个成员身份获取
      const { data: firstMembership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!firstMembership) {
        return NextResponse.json({ error: '无法确定组织' }, { status: 400 })
      }

      orgId = firstMembership.organization_id
    }

    // 校验成员身份（任何成员均可创建）
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    // 创建事件
    const { data: incident, error: insertError } = await supabase
      .from('incidents')
      .insert({
        title,
        description: description || null,
        severity,
        status: 'open',
        project_id,
        organization_id: orgId,
        monitor_id: monitor_id || null,
      })
      .select('*, projects!inner(name, slug), monitors(name)')
      .single()

    if (insertError) {
      console.error('[Incidents] 创建失败:', insertError)
      return NextResponse.json({ error: '创建失败' }, { status: 500 })
    }

    // 自动创建初始事件记录
    const { error: eventError } = await supabase
      .from('incident_events')
      .insert({
        incident_id: incident.id,
        event_type: 'status_change',
        old_value: null,
        new_value: 'open',
        actor_id: user.id,
      })

    if (eventError) {
      console.error('[Incidents] 创建初始事件记录失败:', eventError)
      // 事件已创建成功，仅记录日志，不阻止响应
    }

    return NextResponse.json(incident, { status: 201 })
  } catch (error) {
    console.error('[Incidents] POST 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
