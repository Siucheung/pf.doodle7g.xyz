'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BellRing, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import type { AlertmanagerAlert } from '@/lib/db-types'
import { ALERTMANAGER_ALERT_STATUSES } from '@/lib/constants'

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
}

export default function AlertsPage() {
  const t = useTranslations('alerts')
  const locale = useLocale()
  const params = useParams()
  const orgSlug = params.org as string

  const [alerts, setAlerts] = useState<AlertmanagerAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState('')

  const dateLocale = locale === 'zh-CN' ? zhCN : enUS

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ org: orgSlug })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/alerts?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '加载告警失败')
      }
      const data = await res.json()
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载告警失败')
    } finally {
      setLoading(false)
    }
  }, [orgSlug, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts()
  }, [fetchAlerts])

  const filteredAlerts = searchFilter
    ? alerts.filter((a) => {
        const labels = a.labels as Record<string, string>
        const name = labels.alertname || ''
        return name.toLowerCase().includes(searchFilter.toLowerCase())
      })
    : alerts

  const getAlertName = (alert: AlertmanagerAlert) => {
    const labels = alert.labels as Record<string, string>
    return labels.alertname || labels.job || alert.fingerprint.slice(0, 12)
  }

  const getStatusColor = (status: string) => {
    return status === 'firing'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
      : 'bg-green-500/10 text-green-600 dark:text-green-400'
  }

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || '')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allStatuses')}</SelectItem>
                {Object.entries(ALERTMANAGER_ALERT_STATUSES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 max-w-sm">
            <Input
              placeholder={t('searchAlert')}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        {/* 告警列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchAlerts}>重试</Button>
            </CardContent>
          </Card>
        ) : filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BellRing className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('noAlerts')}</p>
              <p className="text-sm text-muted-foreground">{t('noAlertsDesc')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const labels = alert.labels as Record<string, string>
              const annotations = alert.annotations as Record<string, string>
              const severity = alert.severity || labels.severity || 'warning'
              const colorClass = severityColors[severity] || severityColors.info

              return (
                <Card key={alert.id} className="hover:bg-muted/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${colorClass}`}>
                          <BellRing className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold">
                              {getAlertName(alert)}
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className={getStatusColor(alert.status)}
                            >
                              {alert.status === 'firing' ? t('firing') : t('resolved')}
                            </Badge>
                            <Badge variant="outline" className={colorClass}>
                              {severity}
                            </Badge>
                          </div>
                          <CardDescription className="mt-1">
                            {annotations.summary || annotations.description || ''}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        {t('startsAt')}: {formatDistanceToNow(new Date(alert.starts_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </span>
                      {alert.ends_at && (
                        <span>
                          {t('endsAt')}: {formatDistanceToNow(new Date(alert.ends_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </span>
                      )}
                      {alert.incident && (
                        <Link
                          href={`/${orgSlug}/incidents`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {t('viewIncident')}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {/* 标签云 */}
                    {Object.keys(labels).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-xs font-mono">
                            {k}={v}
                          </Badge>
                        ))}
                        {Object.keys(labels).length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(labels).length - 6}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
