/**
 * Woodpecker CI API 客户端
 *
 * 封装与 Woodpecker CI 服务端的 REST API 交互，用于：
 *   - 注册/注销仓库
 *   - 查询流水线列表和详情
 *   - 触发/取消/重启流水线
 *   - 获取步骤日志
 *
 * 使用管理令牌认证（WOODPECKER_ADMIN_TOKEN）。
 * Woodpecker API 文档：https://woodpecker-ci.org/docs/api/overview
 */

import { createClient } from '@supabase/supabase-js'

// ===== 类型定义 =====

/** Woodpecker 仓库 */
export interface WoodpeckerRepo {
  id: number
  forge_remote_id: number
  owner: string
  name: string
  full_name: string
  clone_url: string
  clone: string
  branch: string
  is_active: boolean
  netrc_only: boolean
  trusted: boolean
  timeout: number
  visibility: string
  allow_pull_requests: boolean
  allow_deployments: boolean
  config_file: string
  cancel_previous_pipeline: boolean
  // 以下字段在 API 响应中可能不存在
  forge_type?: string
  created?: number
  updated?: number
}

/** Woodpecker 流水线 */
export interface WoodpeckerPipeline {
  id: number
  number: number
  repo_id: number
  event: string
  status: string
  message: string
  commit: string
  branch: string
  ref: string
  source: string
  title: string
  author: string
  email: string
  link: string
  errors: string | null
  created: number
  updated: number
  started: number
  finished: number
}

/** Woodpecker 步骤 */
export interface WoodpeckerStep {
  id: number
  pipeline_id: number
  name: string
  status: string
  exit_code: number
  started: number
  finished: number
  error: string | null
  ppid: number
  pid: number
  state: string
  type: string
}

/** Woodpecker 日志行 */
export interface WoodpeckerLogLine {
  time: number
  line: string
  type: string
}

/** Woodpecker Webhook 事件载荷 */
export interface WoodpeckerWebhookPayload {
  repo: {
    id: number
    name: string
    full_name: string
    owner: string
    clone_url: string
  }
  pipeline: {
    id: number
    number: number
    event: string
    status: string
    message: string
    commit: string
    branch: string
    ref: string
    author: string
    email: string
    link: string
    created: number
    started: number
    finished: number
    errors: string | null
    workflows?: Array<{
      name: string
      state: string
      steps?: Array<{
        name: string
        state: string
        exit_code: number
        started: number
        finished: number
      }>
    }>
  }
}

// ===== 客户端 =====

export class WoodpeckerClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    // 确保 baseUrl 不包含末尾斜杠
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = token
  }

  /** 发送带认证的 API 请求 */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Woodpecker API 错误 (${response.status}): ${body.slice(0, 500)}`)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ===== 仓库操作 =====

  /** 注册一个新仓库。需先通过 Forge 关联仓库。 */
  async activateRepo(repoFullName: string): Promise<WoodpeckerRepo> {
    // Woodpecker 的 POST /api/repos 需要 forge_remote_id，
    // 但更简单的接口是先 lookup 再激活
    return this.request<WoodpeckerRepo>(`/repos/lookup/${encodeURIComponent(repoFullName)}`, {
      method: 'POST',
    })
  }

  /** 通过 lookup 或直接注册仓库 */
  async lookupAndActivateRepo(repoFullName: string): Promise<WoodpeckerRepo> {
    // 先尝试 lookup（POST /repos/lookup/{full_name} 会在 forge 中查找并注册）
    return this.request<WoodpeckerRepo>(`/repos/lookup/${encodeURIComponent(repoFullName)}`, {
      method: 'POST',
    })
  }

  /** 获取所有已注册仓库 */
  async listRepos(): Promise<WoodpeckerRepo[]> {
    return this.request<WoodpeckerRepo[]>('/repos')
  }

  /** 获取单个仓库详情 */
  async getRepo(repoId: number): Promise<WoodpeckerRepo> {
    return this.request<WoodpeckerRepo>(`/repos/${repoId}`)
  }

  /** 根据完整名称查找仓库 */
  async getRepoByName(fullName: string): Promise<WoodpeckerRepo | null> {
    try {
      return await this.request<WoodpeckerRepo>(`/repos/lookup/${encodeURIComponent(fullName)}`)
    } catch {
      return null
    }
  }

  /** 注销仓库 */
  async deactivateRepo(repoId: number): Promise<void> {
    await this.request(`/repos/${repoId}`, { method: 'DELETE' })
  }

  /** 设置仓库密钥 */
  async createSecret(
    repoId: number,
    name: string,
    value: string,
    event: string[] = ['push', 'manual', 'pull_request']
  ): Promise<void> {
    await this.request(`/repos/${repoId}/secrets`, {
      method: 'POST',
      body: JSON.stringify({ name, value, event }),
    })
  }

  // ===== 流水线操作 =====

  /** 列出仓库的流水线 */
  async listPipelines(repoId: number, page = 1, limit = 25): Promise<WoodpeckerPipeline[]> {
    return this.request<WoodpeckerPipeline[]>(
      `/repos/${repoId}/pipelines?page=${page}&limit=${limit}`
    )
  }

  /** 获取单个流水线详情 */
  async getPipeline(repoId: number, pipelineNumber: number): Promise<WoodpeckerPipeline> {
    return this.request<WoodpeckerPipeline>(`/repos/${repoId}/pipelines/${pipelineNumber}`)
  }

  /** 手动触发流水线 */
  async triggerPipeline(
    repoId: number,
    options?: { branch?: string; variables?: Record<string, string> }
  ): Promise<WoodpeckerPipeline> {
    return this.request<WoodpeckerPipeline>(`/repos/${repoId}/pipelines`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  /** 取消正在运行的流水线 */
  async cancelPipeline(repoId: number, pipelineNumber: number): Promise<void> {
    await this.request(`/repos/${repoId}/pipelines/${pipelineNumber}/cancel`, {
      method: 'POST',
    })
  }

  /** 重新运行流水线（可指定从失败步骤继续） */
  async restartPipeline(
    repoId: number,
    pipelineNumber: number,
    options?: { from_failure?: boolean }
  ): Promise<WoodpeckerPipeline> {
    return this.request<WoodpeckerPipeline>(`/repos/${repoId}/pipelines/${pipelineNumber}`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  /** 获取流水线步骤列表 */
  async listSteps(repoId: number, pipelineNumber: number): Promise<WoodpeckerStep[]> {
    const pipeline = await this.getPipeline(repoId, pipelineNumber)
    // 步骤信息通过流水线详情的 workflows 获取
    // 这里返回一个虚拟数组，实际步骤在 webhook 中
    return []
  }

  /** 获取步骤日志 */
  async getStepLogs(
    repoId: number,
    pipelineNumber: number,
    stepId: number
  ): Promise<WoodpeckerLogLine[]> {
    return this.request<WoodpeckerLogLine[]>(
      `/repos/${repoId}/pipelines/${pipelineNumber}/logs/${stepId}`
    )
  }
}

/**
 * 从环境变量创建 Woodpecker 客户端实例。
 */
export function getWoodpeckerClient(): WoodpeckerClient {
  const baseUrl = process.env.WOODPECKER_URL || 'http://localhost:8000'
  const token = process.env.WOODPECKER_ADMIN_TOKEN

  if (!token) {
    throw new Error('缺少 WOODPECKER_ADMIN_TOKEN 环境变量')
  }

  return new WoodpeckerClient(baseUrl, token)
}

/**
 * 将 Woodpecker 流水线状态映射为 OpsPilot ci_pipelines.status。
 */
export function mapPipelineStatus(woodpeckerStatus: string): string {
  const map: Record<string, string> = {
    pending: 'pending',
    running: 'running',
    success: 'success',
    failure: 'failure',
    error: 'error',
    killed: 'killed',
    declined: 'killed',
    blocked: 'pending',
  }
  return map[woodpeckerStatus] || woodpeckerStatus
}

/**
 * 将 Woodpecker 流水线事件映射为 OpsPilot ci_pipelines.event。
 */
export function mapPipelineEvent(woodpeckerEvent: string): string {
  const map: Record<string, string> = {
    push: 'push',
    pull_request: 'pull_request',
    tag: 'tag',
    deployment: 'deployment',
    manual: 'manual',
    cron: 'cron',
  }
  return map[woodpeckerEvent] || woodpeckerEvent
}

/**
 * 处理 Woodpecker Webhook 回调，将流水线状态同步到 OpsPilot 数据库。
 */
export async function handleWoodpeckerWebhook(
  payload: WoodpeckerWebhookPayload,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 根据 Woodpecker repo full_name 查找对应的 forge_repos 记录
  const repoFullName = payload.repo.full_name
  const { data: forgeRepo } = await supabase
    .from('forge_repos')
    .select('project_id, organization_id')
    .eq('forge_repo_full_name', repoFullName)
    .single()

  if (!forgeRepo) {
    console.warn(`[Woodpecker Webhook] 未找到仓库映射: ${repoFullName}`)
    return
  }

  const pipeline = payload.pipeline
  const steps = (pipeline.workflows || []).flatMap((wf) =>
    (wf.steps || []).map((step) => ({
      name: `${wf.name}/${step.name}`,
      status: step.state,
      exit_code: step.exit_code,
      duration_ms: step.finished && step.started
        ? (step.finished - step.started) * 1000
        : null,
    }))
  )

  const status = mapPipelineStatus(pipeline.status)
  const event = mapPipelineEvent(pipeline.event)

  // Upsert：按 project_id + pipeline_number 查找，存在则更新，不存在则插入
  const { error } = await supabase.from('ci_pipelines').upsert(
    {
      project_id: forgeRepo.project_id,
      organization_id: forgeRepo.organization_id,
      pipeline_number: pipeline.number,
      status,
      event,
      commit_sha: pipeline.commit,
      commit_message: pipeline.message,
      branch: pipeline.branch,
      author: pipeline.author,
      duration_ms: pipeline.finished && pipeline.created
        ? (pipeline.finished - pipeline.created) * 1000
        : null,
      link_url: pipeline.link,
      steps,
      woodpecker_pipeline_id: pipeline.id,
      error_message: pipeline.errors,
      started_at: pipeline.started ? new Date(pipeline.started * 1000).toISOString() : null,
      finished_at: pipeline.finished ? new Date(pipeline.finished * 1000).toISOString() : null,
    },
    {
      onConflict: 'project_id, pipeline_number',
      ignoreDuplicates: false,
    }
  )

  if (error) {
    console.error('[Woodpecker Webhook] 同步流水线失败:', error.message)
  }
}
