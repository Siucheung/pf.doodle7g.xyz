/**
 * Gitea API 客户端
 *
 * 封装与 Gitea 服务端的 REST API 交互，用于：
 *   - 创建/镜像外部仓库
 *   - 管理仓库设置
 *   - 创建 Gitea OAuth 应用（供 Woodpecker 认证）
 *
 * 使用管理令牌认证（GITEA_ADMIN_TOKEN），
 * 需要 Gitea 管理员在"管理面板 → 应用"中预先生成。
 */

// ===== 类型定义 =====

/** Gitea 仓库 */
export interface GiteaRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string; id: number }
  clone_url: string
  ssh_url: string
  html_url: string
  description: string
  empty: boolean
  private: boolean
  mirror: boolean
  mirror_interval: string
  default_branch: string
  created_at: string
  updated_at: string
}

/** Gitea 创建镜像仓库的请求参数 */
export interface CreateMirrorRepoOptions {
  /** 外部仓库的克隆地址 */
  cloneAddr: string
  /** Gitea 中的仓库名称 */
  repoName: string
  /** 仓库描述 */
  description?: string
  /** 外部仓库的认证信息 */
  authUsername?: string
  authPassword?: string
  /** 镜像间隔（如 "8h0m0s"），为空则手动同步 */
  mirrorInterval?: string
  /** 是否私有仓库 */
  private?: boolean
}

/** Gitea 用户 */
export interface GiteaUser {
  id: number
  login: string
  full_name: string
  email: string
  avatar_url: string
}

/** Gitea OAuth 应用 */
export interface GiteaOAuthApp {
  id: number
  name: string
  client_id: string
  client_secret: string
  redirect_uris: string[]
}

// ===== 客户端 =====

export class GiteaClient {
  private baseUrl: string
  private token: string
  private adminUser: string

  constructor(baseUrl: string, token: string, adminUser = 'opspilot') {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = token
    this.adminUser = adminUser
  }

  /** 发送带认证的 API 请求 */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${this.token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Gitea API 错误 (${response.status}): ${body.slice(0, 500)}`)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ===== 仓库操作 =====

  /**
   * 创建一个镜像仓库，用于同步外部 Git 仓库。
   * 适用于用户将外部 GitHub/GitLab 仓库镜像到自托管 Gitea。
   */
  async createMirrorRepo(options: CreateMirrorRepoOptions): Promise<GiteaRepo> {
    return this.request<GiteaRepo>(`/repos/migrate`, {
      method: 'POST',
      body: JSON.stringify({
        clone_addr: options.cloneAddr,
        repo_name: options.repoName,
        description: options.description || '',
        auth_username: options.authUsername,
        auth_password: options.authPassword,
        mirror: true,
        mirror_interval: options.mirrorInterval || '8h0m0s',
        private: options.private ?? true,
        service: 'git',
      }),
    })
  }

  /**
   * 获取指定仓库的详情。
   * @param owner 仓库所有者（通常是 opspilot 管理员用户）
   * @param repo 仓库名称
   */
  async getRepo(owner: string, repo: string): Promise<GiteaRepo> {
    return this.request<GiteaRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
  }

  /** 获取 Gitea 中已注册的所有仓库 */
  async listRepos(page = 1, limit = 50): Promise<GiteaRepo[]> {
    return this.request<GiteaRepo[]>(`/repos/search?page=${page}&limit=${limit}&uid=0`)
  }

  /** 删除仓库 */
  async deleteRepo(owner: string, repo: string): Promise<void> {
    await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: 'DELETE',
    })
  }

  // ===== 用户/管理操作 =====

  /** 获取管理员用户信息 */
  async getAdminUser(): Promise<GiteaUser> {
    return this.request<GiteaUser>(`/users/${this.adminUser}`)
  }

  /**
   * 创建一个 OAuth 应用（供 Woodpecker 集成）。
   * 将返回的 client_id 和 client_secret 注册到 Woodpecker 配置中。
   */
  async createOAuthApp(name: string, redirectUris: string[]): Promise<GiteaOAuthApp> {
    return this.request<GiteaOAuthApp>(`/user/applications/oauth2`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        redirect_uris: redirectUris,
        confidential_client: true,
      }),
    })
  }

  /** 获取 OAuth 应用列表 */
  async listOAuthApps(): Promise<GiteaOAuthApp[]> {
    return this.request<GiteaOAuthApp[]>(`/user/applications/oauth2`)
  }

  /** 删除 OAuth 应用 */
  async deleteOAuthApp(appId: number): Promise<void> {
    await this.request(`/user/applications/oauth2/${appId}`, {
      method: 'DELETE',
    })
  }
}

/**
 * 从环境变量创建 Gitea 客户端实例。
 */
export function getGiteaClient(): GiteaClient {
  const baseUrl = process.env.GITEA_URL || 'http://localhost:3001'
  const token = process.env.GITEA_ADMIN_TOKEN

  if (!token) {
    throw new Error('缺少 GITEA_ADMIN_TOKEN 环境变量')
  }

  return new GiteaClient(baseUrl, token)
}
