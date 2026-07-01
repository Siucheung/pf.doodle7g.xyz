/**
 * CI Pipeline 步骤日志 API
 * POST /api/ci/logs - 获取指定流水线步骤的日志
 * Body: { projectId: string, pipelineNumber: number, stepName: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWoodpeckerClient } from '@/lib/woodpecker'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, pipelineNumber, stepName } = body

    if (!projectId || !pipelineNumber || !stepName) {
      return NextResponse.json(
        { error: '缺少必要参数: projectId, pipelineNumber, stepName' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 查找 forge_repo 获取 woodpecker_repo_id
    const { data: forgeRepo } = await supabase
      .from('forge_repos')
      .select('woodpecker_repo_id')
      .eq('project_id', projectId)
      .single()

    if (!forgeRepo?.woodpecker_repo_id) {
      return NextResponse.json(
        { error: '未找到仓库的 Woodpecker 映射' },
        { status: 404 }
      )
    }

    const wp = getWoodpeckerClient()
    const repoId = forgeRepo.woodpecker_repo_id

    // 获取流水线详情中的步骤信息
    const detail = await wp.getPipelineDetail(repoId, pipelineNumber)
    const workflowSteps = (detail.workflows || []).flatMap((wf) => wf.steps || [])
    const steps = (detail.workflows || []).flatMap((wf) => wf.steps || [])

    // 通过步骤名称查找匹配步骤
    const matchByName = (name: string) => {
      // 支持完整名称 "workflow/step" 或简名 "step"
      return steps.find(
        (s) => s.name === name || `${steps.indexOf(s)}` === name
      )
    }

    // 尝试按简短步骤名匹配（取最后一段）
    const stepId = steps.find((s) => {
      const shortName = s.name.split('/').pop()
      return s.name === stepName || shortName === stepName
    })?.id

    if (!stepId) {
      return NextResponse.json(
        { error: `未找到步骤: ${stepName}，可用步骤: ${steps.map((s) => s.name).join(', ')}` },
        { status: 404 }
      )
    }

    const logs = await wp.getStepLogs(repoId, pipelineNumber, stepId)

    return NextResponse.json({ logs, stepName: stepName, stepId })

  } catch (error) {
    console.error('[CI Logs] 获取步骤日志失败:', error)
    const msg = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
