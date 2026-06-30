/**
 * 密钥服务抽象层，封装 Infisical 密钥管理操作。
 * 为 API 路由层提供统一的 CRUD 接口。
 */

import { InfisicalClient, getInfisicalClient, InfisicalSecret } from '@/lib/infisical'

/** 创建密钥的输入参数 */
export interface CreateSecretInput {
  key: string
  value: string
  folderPath?: string
  type?: 'shared' | 'personal'
}

/** 更新密钥值的输入参数 */
export interface UpdateSecretInput {
  value: string
}

/**
 * SecretService 封装项目密钥的 CRUD 操作。
 * 按需初始化 Infisical 客户端，延迟加载凭据。
 */
export class SecretService {
  /** Infisical 客户端缓存（延迟初始化） */
  private client: InfisicalClient | null = null

  constructor(private projectId: string) {}

  /**
   * 获取或初始化此项目的 Infisical 客户端。
   * 从数据库加载加密凭据，解密后创建认证客户端。
   */
  private async getClient(): Promise<InfisicalClient> {
    if (!this.client) {
      this.client = await getInfisicalClient(this.projectId)
    }

    if (!this.client) {
      throw new Error('此项目尚未配置 Infisical')
    }

    return this.client
  }

  /**
   * 列出项目默认环境下的所有密钥。
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async listSecrets(folderPath = '/'): Promise<InfisicalSecret[]> {
    const client = await this.getClient()
    return client.listSecrets(folderPath)
  }

  /**
   * 按键名获取单个密钥。
   * @param key 密钥键名
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async getSecret(key: string, folderPath = '/'): Promise<InfisicalSecret | null> {
    const client = await this.getClient()
    return client.getSecret(key, folderPath)
  }

  /**
   * 创建新密钥（Upsert 语义，键名已存在则更新值）。
   * @param input 密钥创建参数（键名、值、文件夹、类型）
   */
  async createSecret(input: CreateSecretInput): Promise<InfisicalSecret> {
    const client = await this.getClient()
    return client.upsertSecret(
      input.key,
      input.value,
      input.folderPath || '/',
      input.type || 'shared'
    )
  }

  /**
   * 更新现有密钥的值。
   * @param key 密钥键名
   * @param value 新的密钥值
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async updateSecret(key: string, value: string, folderPath = '/'): Promise<InfisicalSecret> {
    const client = await this.getClient()
    return client.upsertSecret(key, value, folderPath, 'shared')
  }

  /**
   * 删除指定密钥。
   * @param key 密钥键名
   * @param folderPath 文件夹路径，默认为根目录 "/"
   */
  async deleteSecret(key: string, folderPath = '/'): Promise<void> {
    const client = await this.getClient()
    return client.deleteSecret(key, folderPath)
  }

  /**
   * 列出项目中的文件夹。
   * @param folderPath 父文件夹路径，默认为根目录 "/"
   */
  async listFolders(folderPath = '/'): Promise<{ id: string; name: string; path: string }[]> {
    const client = await this.getClient()
    return client.listFolders(folderPath)
  }
}
