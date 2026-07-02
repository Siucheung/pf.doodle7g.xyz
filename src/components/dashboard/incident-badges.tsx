'use client'

import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_EVENT_TYPES } from '@/lib/constants'

export function IncidentSeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
    critical: 'destructive',
    warning: 'default',
    info: 'secondary',
  }

  return (
    <Badge variant={variants[severity] || 'secondary'}>
      {INCIDENT_SEVERITIES[severity as keyof typeof INCIDENT_SEVERITIES] || severity}
    </Badge>
  )
}

export function IncidentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    open: 'destructive',
    acknowledged: 'default',
    resolved: 'secondary',
    muted: 'outline',
  }

  return (
    <Badge variant={variants[status] || 'outline'}>
      {INCIDENT_STATUSES[status as keyof typeof INCIDENT_STATUSES] || status}
    </Badge>
  )
}

export function EventTypeBadge({ eventType, label }: { eventType: string; label?: string }) {
  const t = useTranslations('incidents')
  const fallbackLabels: Record<string, string> = {
    status_change: t('statusChanged'),
    comment: t('comment'),
    assignment: t('assignment'),
    trigger: t('triggered'),
  }

  return (
    <Badge variant="outline" className="text-xs">
      {label || fallbackLabels[eventType] || eventType}
    </Badge>
  )
}

export { INCIDENT_EVENT_TYPES }
