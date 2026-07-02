'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Shield, Loader2, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'
import type { AuditLog } from '@/lib/db-types'

const operationColors: Record<string, string> = {
  INSERT: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
}

const AUDIT_TABLES = ['projects', 'incidents', 'notification_channels', 'credentials'] as const
const AUDIT_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'] as const

export default function AuditPage() {
  const t = useTranslations('audit')
  const locale = useLocale()
  const params = useParams()
  const orgSlug = params.org as string

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableFilter, setTableFilter] = useState<string>('')
  const [operationFilter, setOperationFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState('')

  const dateLocale = locale === 'zh-CN' ? zhCN : enUS

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ org: orgSlug })
      if (tableFilter) params.set('table', tableFilter)
      if (operationFilter) params.set('operation', operationFilter)

      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('loadFailed'))
      }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [orgSlug, tableFilter, operationFilter])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filteredLogs = searchFilter
    ? logs.filter((l) => {
        const idMatch = l.record_id?.toLowerCase().includes(searchFilter.toLowerCase())
        const tableMatch = l.table_name.toLowerCase().includes(searchFilter.toLowerCase())
        return idMatch || tableMatch
      })
    : logs

  const formatJson = (data: Record<string, unknown> | null) => {
    if (!data) return '-'
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={tableFilter} onValueChange={(v) => setTableFilter(v || '')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allTables')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('allTables')}</SelectItem>
              {AUDIT_TABLES.map((table) => (
                <SelectItem key={table} value={table}>{t(table)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operationFilter} onValueChange={(v) => setOperationFilter(v || '')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t('operation')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('operation')}</SelectItem>
              {AUDIT_OPERATIONS.map((op) => (
                <SelectItem key={op} value={op}>{t(op)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 max-w-sm">
            <Input
              placeholder={t('searchRecord')}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        {/* 审计日志列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchLogs}>{t('retry')}</Button>
            </CardContent>
          </Card>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('noLogs')}</p>
              <p className="text-sm text-muted-foreground">{t('noLogsDesc')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const colorClass = operationColors[log.operation] || operationColors.UPDATE

              return (
                <Card key={log.id} className="hover:bg-muted/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={colorClass}>
                          {t(log.operation)}
                        </Badge>
                        <Badge variant="secondary">{t(log.table_name)}</Badge>
                        {log.record_id && (
                          <code className="text-xs text-muted-foreground font-mono">
                            {log.record_id.slice(0, 8)}...
                          </code>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  </CardHeader>
                  {(log.old_data || log.new_data) && (
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {log.new_data && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t('newValue')}</p>
                            <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-auto max-h-32 font-mono">
                              {formatJson(log.new_data)}
                            </pre>
                          </div>
                        )}
                        {log.old_data && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t('oldValue')}</p>
                            <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-auto max-h-32 font-mono">
                              {formatJson(log.old_data)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
