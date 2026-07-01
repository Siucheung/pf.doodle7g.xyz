/**
 * Alertmanager API 客户端
 *
 * 提供与 Prometheus Alertmanager 交互的能力：
 * - 查询当前活跃告警
 * - 管理 Silence（静默规则）
 * - 健康检查
 *
 * Alertmanager API v2：https://prometheus.io/docs/alerting/latest/management_api/
 */

const ALERTMANAGER_BASE_URL = process.env.ALERTMANAGER_URL || 'http://localhost:9093'

// ===== 类型定义 =====

export interface AlertmanagerAlertItem {
  labels: Record<string, string>
  annotations: Record<string, string>
  startsAt: string
  endsAt: string
  generatorURL: string
  fingerprint: string
  status: {
    state: 'firing' | 'resolved'
    silencedBy: string[]
    inhibitedBy: string[]
  }
  receivers: Array<{ name: string }>
}

export interface AlertmanagerSilence {
  id: string
  status: {
    state: 'active' | 'expired' | 'pending'
  }
  updatedAt: string
  comment: string
  createdBy: string
  endsAt: string
  startsAt: string
  matchers: Array<{
    name: string
    value: string
    isRegex: boolean
    isEqual: boolean
  }>
}

export interface AlertmanagerSilenceInput {
  comment: string
  createdBy: string
  endsAt: string
  startsAt: string
  matchers: Array<{
    name: string
    value: string
    isRegex?: boolean
    isEqual?: boolean
  }>
}

export interface AlertmanagerStatus {
  cluster: {
    peers: string[]
    status: string
  }
  versionInfo: Record<string, string>
  uptime: number
}

export interface AlertmanagerWebhookPayload {
  version: string
  groupKey: string
  truncatedAlerts: number
  status: 'firing' | 'resolved'
  receiver: string
  groupLabels: Record<string, string>
  commonLabels: Record<string, string>
  commonAnnotations: Record<string, string>
  externalURL: string
  alerts: Array<{
    status: 'firing' | 'resolved'
    labels: Record<string, string>
    annotations: Record<string, string>
    startsAt: string
    endsAt: string
    generatorURL: string
    fingerprint: string
  }>
}

// ===== API 方法 =====

/**
 * 查询 Alertmanager 当前活跃告警列表
 */
export async function getAlerts(
  options?: { silenced?: boolean; inhibited?: boolean; active?: boolean }
): Promise<AlertmanagerAlertItem[]> {
  const params = new URLSearchParams()
  if (options?.silenced !== undefined) params.set('silenced', String(options.silenced))
  if (options?.inhibited !== undefined) params.set('inhibited', String(options.inhibited))
  if (options?.active !== undefined) params.set('active', String(options.active))

  const url = `${ALERTMANAGER_BASE_URL}/api/v2/alerts${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) throw new Error(`Alertmanager API 返回 ${res.status}`)
  return res.json()
}

/**
 * 获取单个告警详情
 */
export async function getAlert(fingerprint: string): Promise<AlertmanagerAlertItem | null> {
  try {
    const res = await fetch(
      `${ALERTMANAGER_BASE_URL}/api/v2/alert/${fingerprint}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * 创建 Silence（静默规则）
 */
export async function createSilence(silence: AlertmanagerSilenceInput): Promise<string> {
  const res = await fetch(`${ALERTMANAGER_BASE_URL}/api/v2/silences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(silence),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`创建 Silence 失败 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.silenceID
}

/**
 * 获取 Silence 列表
 */
export async function getSilences(
  options?: { filter?: string }
): Promise<AlertmanagerSilence[]> {
  const params = new URLSearchParams()
  if (options?.filter) params.set('filter', options.filter)

  const url = `${ALERTMANAGER_BASE_URL}/api/v2/silences${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Alertmanager API 返回 ${res.status}`)
  return res.json()
}

/**
 * 删除 Silence
 */
export async function deleteSilence(silenceId: string): Promise<boolean> {
  const res = await fetch(`${ALERTMANAGER_BASE_URL}/api/v2/silences/${silenceId}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(5000),
  })
  return res.ok
}

/**
 * 检查 Alertmanager 服务健康状态
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${ALERTMANAGER_BASE_URL}/api/v2/status`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 根据 Alertmanager 告警的 labels 推断严重程度
 */
export function inferSeverity(labels: Record<string, string>): string {
  const severity = labels.severity || labels.priority || ''
  const sev = severity.toLowerCase()

  if (sev === 'critical' || sev === 'crit' || sev === 'p0' || sev === 'p1') return 'critical'
  if (sev === 'warning' || sev === 'warn' || sev === 'p2' || sev === 'p3') return 'warning'
  return 'info'
}

/**
 * 从 labels + annotations 中提取告警标题
 */
export function extractTitle(
  labels: Record<string, string>,
  annotations: Record<string, string>
): string {
  return annotations.summary || annotations.title || labels.alertname || labels.job || '未知告警'
}

/**
 * 从 annotations 中提取告警描述
 */
export function extractDescription(annotations: Record<string, string>): string {
  return annotations.description || annotations.message || ''
}
