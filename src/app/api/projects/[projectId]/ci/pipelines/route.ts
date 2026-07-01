/**
 * 项目 CI 流水线 API
 *
 * GET  /api/projects/{projectId}/ci/pipelines  — 获取流水线列表
 * POST /api/projects/{projectId}/ci/pipelines  — 手动触发流水线
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWoodpeckerClient } from '@/lib/woodpecker'
import type { CiPipeline } from '@/lib/db-types'

/**
 * GET — 获取项目的 CI 流水线列表。
 * 支持 ?limit=50&offset=0 分页。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // 验证用户身份
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取项目信息以验证组织和权限
    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 验证用户是该项目组织的成员
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 解析分页参数
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // 从数据库查询 CI 流水线记录
    const { data: pipelines, error } = await supabase
      .from('ci_pipelines')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 获取总数
    const { count } = await supabase
      .from('ci_pipelines')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    return NextResponse.json({
      pipelines: pipelines as CiPipeline[],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[CI] 获取流水线列表失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST — 手动触发 CI 流水线。
 * 请求体可选：{ branch?: string, variables?: Record<string, string> }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // 验证用户身份和权限
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 查找对应的 Woodpecker 仓库
    const { data: forgeRepo } = await supabase
      .from('forge_repos')
      .select('woodpecker_repo_id')
      .eq('project_id', projectId)
      .single()

    if (!forgeRepo?.woodpecker_repo_id) {
      return NextResponse.json(
        { error: '该项目尚未关联 CI 仓库。请先在项目设置中配置仓库连接。' },
        { status: 400 }
      )
    }

    // 解析请求参数
    const body = await request.json().catch(() => ({}))
    const { branch, variables } = body as {
      branch?: string
      variables?: Record<string, string>
    }

    // 调用 Woodpecker API 触发流水线
    const woodpecker = getWoodpeckerClient()
    const pipeline = await woodpecker.triggerPipeline(forgeRepo.woodpecker_repo_id, {
      branch,
      variables,
    })

    // 在本地数据库中创建流水线记录（初始状态）
    const { error: insertError } = await supabase.from('ci_pipelines').insert({
      project_id: projectId,
      organization_id: project.organization_id,
      pipeline_number: pipeline.number,
      status: 'pending',
      event: 'manual',
      commit_sha: pipeline.commit,
      commit_message: pipeline.message,
      branch: pipeline.branch,
      author: pipeline.author,
      link_url: pipeline.link,
      woodpecker_pipeline_id: pipeline.id,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[CI] 创建流水线记录失败:', insertError.message)
      // 不阻止返回成功——Woodpecker 侧已经触发
    }

    return NextResponse.json({ pipeline }, { status: 201 })
  } catch (error) {
    console.error('[CI] 触发流水线失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
