/**
 * 单条 CI 流水线详情/操作 API
 *
 * GET   /api/projects/{projectId}/ci/pipelines/{number}        — 获取流水线详情
 * POST  /api/projects/{projectId}/ci/pipelines/{number}        — 重新运行流水线
 * POST  /api/projects/{projectId}/ci/pipelines/{number}/cancel — 取消流水线
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWoodpeckerClient } from '@/lib/woodpecker'
import type { CiPipeline } from '@/lib/db-types'

/**
 * GET — 获取单条流水线详情
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; number: string }> }
) {
  try {
    const { projectId, number } = await params
    const pipelineNumber = parseInt(number)

    if (isNaN(pipelineNumber)) {
      return NextResponse.json({ error: 'Invalid pipeline number' }, { status: 400 })
    }

    const supabase = await createClient()

    // 验证用户身份
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 查询流水线
    const { data: pipeline, error } = await supabase
      .from('ci_pipelines')
      .select('*')
      .eq('project_id', projectId)
      .eq('pipeline_number', pipelineNumber)
      .single()

    if (error || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 验证用户是该项目组织的成员
    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (project) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', project.organization_id)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ pipeline: pipeline as CiPipeline })
  } catch (error) {
    console.error('[CI] 获取流水线详情失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST — 重新运行流水线。
 * 请求体可选：{ from_failure?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; number: string }> }
) {
  try {
    const { projectId, number } = await params
    const pipelineNumber = parseInt(number)

    if (isNaN(pipelineNumber)) {
      return NextResponse.json({ error: 'Invalid pipeline number' }, { status: 400 })
    }

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
      return NextResponse.json({ error: '项目未关联 CI 仓库' }, { status: 400 })
    }

    // 解析请求参数：是否仅重试失败步骤
    const body = await request.json().catch(() => ({}))
    const fromFailure = body?.from_failure === true

    // 调用 Woodpecker API 重新运行
    const woodpecker = getWoodpeckerClient()
    const pipeline = await woodpecker.restartPipeline(
      forgeRepo.woodpecker_repo_id,
      pipelineNumber,
      { from_failure: fromFailure }
    )

    return NextResponse.json({ pipeline })
  } catch (error) {
    console.error('[CI] 重新运行流水线失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
