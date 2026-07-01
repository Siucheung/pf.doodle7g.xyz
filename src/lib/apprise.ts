/**
 * Apprise 通知客户端
 *
 * Apprise 是一个统一的 REST API 通知网关，支持 130+ 通知服务。
 * OpsPilot 将通知渠道配置存储在自己的数据库中，
 * 在需要发送通知时将 Apprise URL 传递给 Apprise API。
 *
 * Apprise API：https://github.com/caronc/apprise-api
 * 支持的服务列表：https://github.com/caronc/apprise#supported-notifications
 */

const APPRISE_BASE_URL = process.env.APPRISE_BASE_URL || 'http://localhost:8001'

export interface AppriseNotifyOptions {
  /** 通知标题 */
  title?: string
  /** 通知正文 */
  body: string
  /** 通知类型（用于着色标记） */
  type?: 'info' | 'success' | 'warning' | 'failure'
  /** 目标 Apprise URL 列表（如不指定则使用 APPRISE_STATELESS_URLS） */
  urls?: string[]
  /** 预配置的通知键名（在 Apprise 中通过 /add/{KEY} 保存的配置） */
  key?: string
  /** 附加标签 */
  tag?: string
  /** 附件 URL */
  attachment_url?: string
}

export interface AppriseResponse {
  /** 处理结果状态 */
  status: 'posted' | 'failed' | 'mixed' | 'unknown'
  /** 成功发送数 */
  sent_count: number
  /** 失败数 */
  error_count: number
  /** 详细结果 */
  results?: Array<{
    service: string
    status: 'sent' | 'failed'
    error?: string
  }>
}

/**
 * 通过 Apprise API 发送通知（无状态模式）
 * 在请求体中直接传递通知 URL，不依赖 Apprise 服务端存储的配置
 */
export async function notify(options: AppriseNotifyOptions): Promise<AppriseResponse> {
  const { title, body, type, urls, key, tag, attachment_url } = options

  const payload: Record<string, unknown> = {
    title,
    body,
    format: 'text',
    type: type || 'info',
    tag,
  }

  // 无状态模式：在请求中直接传递 URL
  if (urls && urls.length > 0) {
    payload.urls = urls.join(',')
  }

  // 有状态模式：使用预配置的 KEY
  if (key) {
    payload.key = key
  }

  // 可选附件
  if (attachment_url) {
    payload.attachment_url = attachment_url
  }

  let endpoint: string
  if (key) {
    endpoint = `${APPRISE_BASE_URL}/notify/${key}`
  } else {
    endpoint = `${APPRISE_BASE_URL}/notify`
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[Apprise] 请求失败 (${res.status}): ${errText}`)
      throw new Error(`Apprise API 返回 ${res.status}: ${errText}`)
    }

    const data: AppriseResponse = await res.json()

    if (data.status === 'failed' || data.error_count > 0) {
      console.warn(`[Apprise] 部分通知发送失败: ${data.error_count} 个错误`)
    }

    return data
  } catch (error) {
    console.error('[Apprise] 通知发送异常:', error)
    throw error
  }
}

/**
 * 在 Apprise 服务端保存一组通知 URL 配置
 * 之后可通过 /notify/{KEY} 发送，无需重复传递 URL
 */
export async function saveConfig(key: string, urls: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${APPRISE_BASE_URL}/add/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: urls.join(','),
        format: 'text',
      }),
    })
    return res.ok
  } catch (error) {
    console.error('[Apprise] 保存配置失败:', error)
    return false
  }
}

/**
 * 删除 Apprise 服务端保存的通知配置
 */
export async function deleteConfig(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${APPRISE_BASE_URL}/del/${key}`, {
      method: 'POST',
    })
    return res.ok
  } catch (error) {
    console.error('[Apprise] 删除配置失败:', error)
    return false
  }
}

/**
 * 获取 Apprise 服务端已保存的配置列表
 */
export async function getConfig(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${APPRISE_BASE_URL}/get/${key}`, {
      method: 'POST',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.urls || data.config || null
  } catch (error) {
    console.error('[Apprise] 获取配置失败:', error)
    return null
  }
}

/**
 * 检查 Apprise 服务是否在线
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${APPRISE_BASE_URL}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 验证 Apprise URL 是否合法
 * URL 格式示例：
 *   slack://tokenA/tokenB/tokenC/#channel
 *   discord://webhook_id/webhook_token
 *   tgram://bot_token/-123456789
 *   mailto://user:pass@host:port
 *   json://localhost:8080/webhook/path
 */
export function isValidAppriseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  // Apprise URL 必须包含 :// 并且 scheme 不能是 http/https（那些是直接 HTTP 请求）
  // 但 webhook 使用 json://, jsonp://, custom:// 等 scheme
  const appriseSchemes = [
    'slack://', 'discord://', 'tgram://', 'telegram://',
    'mailto://', 'mailto://', 'mailgun://', 'smtp://',
    'json://', 'jsonp://', 'json://', 'matrix://',
    'gotify://', 'ntfy://', 'pushover://', 'pushbullet://',
    'prowl://', 'simplepush://', 'twilio://', 'twist://',
    'rocket://', 'mattermost://', 'teams://', 'webhook://',
    'webhook-relay://', 'zulip://', 'gotify://', 'glip://',
    'clickatell://', 'join://', 'kavenegar://', 'kumulos://',
    'line://', 'msteams://', 'nexmo://', 'pushalot://',
    'pushsafer://', 'sinch://', 'sinch://', 'sparkpost://',
    'syslog://', 'twilio://', 'typetalk://', 'viber://',
    'vk://', 'whatsapp://', 'xbmc://', 'xmpp://',
    'custom://',
  ]

  // 宽松验证：只要包含 :// 且不以 http:// 或 https:// 开头即可
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // HTTP/HTTPS URL 也可以用于 webhook 类的 Apprise 服务
    return url.length > 10
  }

  return url.includes('://') && url.length > 5
}
