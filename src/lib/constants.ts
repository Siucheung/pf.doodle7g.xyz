export const APP_NAME = 'OpsPilot'
export const APP_DESCRIPTION = 'Software Operations Platform'

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
  viewer: 'viewer',
} as const

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

export const DEPLOYMENT_STATUSES = {
  pending: 'Pending',
  building: 'Building',
  success: 'Success',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const

export const DEPLOYMENT_ENVIRONMENTS = {
  preview: 'Preview',
  staging: 'Staging',
  production: 'Production',
} as const

export const MONITOR_STATUSES = {
  up: 'Up',
  down: 'Down',
  degraded: 'Degraded',
} as const

export const LOG_LEVELS = ['info', 'warn', 'error', 'debug'] as const

export const LOG_SOURCES = ['build', 'runtime', 'edge', 'function'] as const

export const INCIDENT_SEVERITIES = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
} as const

export const INCIDENT_STATUSES = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  muted: 'Muted',
} as const

export const INCIDENT_EVENT_TYPES = [
  'status_change',
  'comment',
  'assignment',
  'trigger',
] as const

export const PLANS = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
} as const

export const SIDEBAR_ITEMS = [
  { titleKey: 'overview', href: '', icon: 'LayoutDashboard' },
  { titleKey: 'projects', href: 'projects', icon: 'FolderOpen' },
  { titleKey: 'deployments', href: 'deployments', icon: 'Rocket' },
  { titleKey: 'monitors', href: 'monitors', icon: 'Activity' },
  { titleKey: 'logs', href: 'logs', icon: 'ScrollText' },
  { titleKey: 'incidents', href: 'incidents', icon: 'AlertTriangle' },
  // 注意："密钥"是项目级页面（/{org}/projects/{project}/secrets），
  // 不属于组织级侧栏导航。通过项目详情页的 Tab 访问。
  { titleKey: 'team', href: 'team', icon: 'Users' },
  { titleKey: 'settings', href: 'settings', icon: 'Settings' },
] as const

export const PROJECT_STATUSES = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
} as const
