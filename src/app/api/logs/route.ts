/**
 * 日志 API
 * GET  /api/logs?org=:slug&since=ISO&level=:level&source=:source&search=:keyword&limit=N
 * POST /api/logs — 写入单条日志
 *   Body: { orgSlug, projectSlug?, level, message, source?, deploymentId?, metadata? }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgSlug = searchParams.get('org')
    const since = searchParams.get('since')
    const level = searchParams.get('level')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

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
      .from('logs')
      .select('*, project:projects(name, slug)')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (since) {
      query = query.gte('created_at', since)
    }

    if (level) {
      query = query.eq('level', level)
    }

    if (source) {
      query = query.eq('source', source)
    }

    if (search) {
      query = query.ilike('message', `%${search}%`)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('[Logs] 查询失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    // 按时间升序返回（方便追加到列表尾部）
    return NextResponse.json((logs || []).reverse())
  } catch (error) {
    console.error('[Logs] GET 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orgSlug, projectSlug, level, message, source, deploymentId, metadata } = body

    if (!orgSlug || !level || !message) {
      return NextResponse.json(
        { error: '缺少必要参数: orgSlug, level, message' },
        { status: 400 }
      )
    }

    if (!['info', 'warn', 'error', 'debug'].includes(level)) {
      return NextResponse.json(
        { error: '无效的 level，可选: info, warn, error, debug' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 查找组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    // 可选：查找项目
    let projectId: string | null = null
    if (projectSlug) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', projectSlug)
        .eq('organization_id', org.id)
        .single()

      if (project) {
        projectId = project.id
      }
    }

    const { data: newLog, error } = await supabase
      .from('logs')
      .insert({
        project_id: projectId,
        organization_id: org.id,
        deployment_id: deploymentId || null,
        level,
        message,
        source: source || null,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('[Logs] 写入失败:', error)
      return NextResponse.json({ error: '写入失败' }, { status: 500 })
    }

    return NextResponse.json(newLog, { status: 201 })
  } catch (error) {
    console.error('[Logs] POST 异常:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
