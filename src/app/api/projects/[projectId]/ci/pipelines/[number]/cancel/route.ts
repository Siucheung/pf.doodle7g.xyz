/**
 * 取消流水线 API
 *
 * POST /api/projects/{projectId}/ci/pipelines/{number}/cancel — 取消正在运行的流水线
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWoodpeckerClient } from '@/lib/woodpecker'

export async function POST(
  _request: Request,
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

    // 调用 Woodpecker API 取消流水线
    const woodpecker = getWoodpeckerClient()
    await woodpecker.cancelPipeline(forgeRepo.woodpecker_repo_id, pipelineNumber)

    // 更新本地数据库状态
    await supabase
      .from('ci_pipelines')
      .update({ status: 'killed', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('pipeline_number', pipelineNumber)

    return NextResponse.json({ cancelled: true })
  } catch (error) {
    console.error('[CI] 取消流水线失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
