'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { ScrollText, Loader2, Pause, Play, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'
import type { LogEntry } from '@/lib/db-types'
import { LOG_LEVELS, LOG_SOURCES } from '@/lib/constants'

export default function LogsPage() {
  const t = useTranslations('logs')
  const locale = useLocale()
  const params = useParams()
  const orgSlug = params.org as string
  const dateLocale = locale === 'zh-CN' ? zhCN : enUS

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)

  // Filters
  const [levelFilter, setLevelFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = useCallback(async (since?: string) => {
    try {
      setError(null)
      const params = new URLSearchParams({ org: orgSlug })
      if (since) params.set('since', since)
      if (levelFilter) params.set('level', levelFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (searchFilter) params.set('search', searchFilter)

      const res = await fetch(`/api/logs?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const data: LogEntry[] = await res.json()

      if (since && data.length > 0) {
        // Polling mode: append new logs, skip duplicates
        setLogs((prev) => {
          const existing = new Set(prev.map((l) => l.id))
          const newLogs = data.filter((l) => !existing.has(l.id))
          return [...prev, ...newLogs]
        })
      } else {
        setLogs(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取日志失败')
    } finally {
      setLoading(false)
    }
  }, [orgSlug, levelFilter, sourceFilter, searchFilter])

  // Initial fetch + filter change
  useEffect(() => {
    setLoading(true)
    fetchLogs()
  }, [fetchLogs])

  // Polling
  useEffect(() => {
    if (paused) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    pollRef.current = setInterval(() => {
      const since = logs.length > 0 ? logs[logs.length - 1].created_at : undefined
      fetchLogs(since)
    }, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, logs.length, fetchLogs])

  // Auto scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    if (!isAtBottom && autoScroll) setAutoScroll(false)
    if (isAtBottom && !autoScroll) setAutoScroll(true)
  }

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {logs.length} entries
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <Play className="h-4 w-4 mr-1" />
              ) : (
                <Pause className="h-4 w-4 mr-1" />
              )}
              {paused ? t('resume') : t('pause')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchLogs')}
              className="pl-8"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v ?? '')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('allLevels')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('allLevels')}</SelectItem>
              {LOG_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? '')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('allSources')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('allSources')}</SelectItem>
              {LOG_SOURCES.map((src) => (
                <SelectItem key={src} value={src}>
                  {src.charAt(0).toUpperCase() + src.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <Card>
          {loading && logs.length === 0 ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : logs.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <ScrollText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noLogs')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('logsDesc')}
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t('logStream')}</CardTitle>
                  {!paused && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Live
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="divide-y max-h-[600px] overflow-y-auto"
                >
                  {logs.map((log: LogEntry) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors font-mono text-xs"
                    >
                      <Badge
                        variant={
                          log.level === 'error'
                            ? 'destructive'
                            : log.level === 'warn'
                            ? 'default'
                            : 'secondary'
                        }
                        className="mt-0.5 shrink-0 text-[10px] px-1.5"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="break-all">{log.message}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                          {log.project && (
                            <span className="font-medium">{log.project.name}</span>
                          )}
                          {log.source && (
                            <>
                              <span>·</span>
                              <span className="capitalize">{log.source}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!autoScroll && logs.length > 0 && (
                  <div className="flex justify-center py-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setAutoScroll(true)
                        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
                      }}
                    >
                      ↓ {t('scrollToBottom')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
