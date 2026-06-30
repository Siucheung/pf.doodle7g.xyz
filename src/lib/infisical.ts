/**
 * Infisical 客户端单例，使用 Machine Identity 认证。
 * 管理对 Infisical API 的编程式访问，用于密钥管理。
 *
 * 架构设计：
 * - 每个 OpsPilot 项目分配一个独立的 Infisical Machine Identity
 * - Machine Identity 凭据（clientId + clientSecret）加密存储在 Supabase
 * - 按需使用 Universal Auth 换取短期访问令牌
 * - 访问令牌缓存在内存中，过期前 5 分钟自动刷新
 */

import { decrypt } from '@/lib/encryption'
import { createClient } from '@supabase/supabase-js'

/** Infisical Machine Identity 凭据 */
export interface InfisicalMachineIdentity {
  clientId: string
  clientSecret: string // 加密存储在数据库中
  projectId: string
  environment: string
  infisicalUrl: string
}

/** Infisical 密钥实体 */
export interface InfisicalSecret {
  id: string
  key: string
  value: string
  type: 'shared' | 'personal'
  environment: string
  folder: string
  createdAt: string
  updatedAt: string
}

/** Infisical 项目实体 */
export interface InfisicalProject {
  id: string
  name: string
  slug: string
  environments: string[]
}

/** Infisical 文件夹实体 */
export interface InfisicalFolder {
  id: string
  name: string
  path: string
}

/**
 * InfisicalClient 封装所有与 Infisical API 的交互。
 * 使用 Machine Identity（Universal Auth）进行认证。
 */
export class InfisicalClient {
  /** 访问令牌缓存 */
  private accessToken: string | null = null
  /** 令牌过期时间戳 */
  private tokenExpiry: number = 0
  /** Machine Identity 凭据 */
  private machineIdentity: InfisicalMachineIdentity | null = null

  constructor(private identity: InfisicalMachineIdentity) {
    this.machineIdentity = identity
  }

  /**
   * 使用 Machine Identity 向 Infisical 认证（Universal Auth 流程）。
   * 令牌会被缓存，过期前复用，避免频繁认证。
   */
  private async authenticate(): Promise<string> {
    // 缓存未过期则直接返回
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // 解密数据库中存储的 Client Secret
    const clientSecret = decrypt(this.machineIdentity!.clientSecret)

    const response = await fetch(
      `${this.machineIdentity!.infisicalUrl}/api/v1/auth/universal-auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.machineIdentity!.clientId,
          clientSecret: clientSecret,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Infisical 认证失败: ${error}`)
    }

    const data = await response.json() as { accessToken: string; expiresIn?: number }

    if (!data.accessToken) {
      throw new Error('Infisical 认证失败: 响应中未包含 accessToken')
    }

    this.accessToken = data.accessToken
    // 设置过期时间，预留 5 分钟安全缓冲
    this.tokenExpiry = Date.now() + (data.expiresIn || 3600) * 1000 - 5 * 60 * 1000

    return this.accessToken
  }

  /**
   * 发送带认证的 Infisical API 请求。
   * 自动附加 Bearer 令牌，处理 204 空响应。
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.authenticate()

    const url = `${this.machineIdentity!.infisicalUrl}/api/v1${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Infisical API 错误 (${response.status}): ${error}`)
    }

    // 处理 204 No Content（如删除操作）
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ===== 密钥操作 =====

  /**
   * 列出指定文件夹中的所有密钥。
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async listSecrets(folderPath = '/'): Promise<InfisicalSecret[]> {
    const projectId = this.machineIdentity!.projectId
    const environment = this.machineIdentity!.environment

    const response = await this.request<{ secrets: InfisicalSecret[] }>(
      `/projects/${projectId}/secrets?environment=${environment}&folderPath=${encodeURIComponent(folderPath)}`
    )

    return response.secrets || []
  }

  /**
   * 根据键名获取单个密钥。
   * @param key 密钥键名
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async getSecret(key: string, folderPath = '/'): Promise<InfisicalSecret | null> {
    const projectId = this.machineIdentity!.projectId
    const environment = this.machineIdentity!.environment

    try {
      const response = await this.request<{ secret: InfisicalSecret }>(
        `/projects/${projectId}/secrets/${encodeURIComponent(key)}?environment=${environment}&folderPath=${encodeURIComponent(folderPath)}`
      )
      return response.secret
    } catch {
      return null
    }
  }

  /**
   * 创建或更新密钥（Upsert 语义）。
   * @param key 密钥键名
   * @param value 密钥值
   * @param folderPath 文件夹路径，默认为根目录 "/"
   * @param type 密钥类型，shared（共享）或 personal（个人），默认 shared
   */
  async upsertSecret(
    key: string,
    value: string,
    folderPath = '/',
    type: 'shared' | 'personal' = 'shared'
  ): Promise<InfisicalSecret> {
    const projectId = this.machineIdentity!.projectId
    const environment = this.machineIdentity!.environment

    const response = await this.request<{ secret: InfisicalSecret }>(
      `/projects/${projectId}/secrets?environment=${environment}&folderPath=${encodeURIComponent(folderPath)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          secretKey: key,
          secretValue: value,
          type,
        }),
      }
    )

    return response.secret
  }

  /**
   * 删除指定密钥。
   * @param key 密钥键名
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async deleteSecret(key: string, folderPath = '/'): Promise<void> {
    const projectId = this.machineIdentity!.projectId
    const environment = this.machineIdentity!.environment

    await this.request(
      `/projects/${projectId}/secrets/${encodeURIComponent(key)}?environment=${environment}&folderPath=${encodeURIComponent(folderPath)}`,
      {
        method: 'DELETE',
      }
    )
  }

  // ===== 文件夹操作 =====

  /**
   * 列出指定路径下的所有文件夹。
   * @param folderPath 父文件夹路径，默认为根目录 "/"
   */
  async listFolders(folderPath = '/'): Promise<InfisicalFolder[]> {
    const projectId = this.machineIdentity!.projectId
    const environment = this.machineIdentity!.environment

    const response = await this.request<{ folders: InfisicalFolder[] }>(
      `/projects/${projectId}/folders?environment=${environment}&folderPath=${encodeURIComponent(folderPath)}`
    )

    return response.folders || []
  }

  // ===== 项目操作 =====

  /**
   * 列出当前 Machine Identity 可访问的所有 Infisical 项目。
   */
  async listProjects(): Promise<InfisicalProject[]> {
    const response = await this.request<{ projects: InfisicalProject[] }>('/projects')

    return response.projects || []
  }
}

/**
 * 为指定项目创建 Infisical 客户端，使用数据库中存储的加密凭据。
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY 绕过 RLS 进行服务端凭据检索。
 * 这是有意设计的：infisical_credentials 表存储加密密钥，
 * 仅允许服务端通过 service_role 访问，不对外暴露客户端 RLS 策略。
 */
export async function getInfisicalClient(projectId: string): Promise<InfisicalClient | null> {
  // 优先使用服务端 SUPABASE_URL，兼容开发环境 NEXT_PUBLIC_ 回退
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: credentials, error } = await supabase
    .from('infisical_credentials')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error || !credentials) {
    return null
  }

  return new InfisicalClient({
    clientId: credentials.machine_identity_client_id,
    clientSecret: credentials.machine_identity_client_secret_encrypted,
    projectId: credentials.infisical_project_id,
    environment: credentials.infisical_environment,
    infisicalUrl: credentials.infisical_url,
  })
}
