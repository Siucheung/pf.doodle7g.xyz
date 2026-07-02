'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Terminal, XCircle } from 'lucide-react'

interface LogLine {
  time: number
  line: string
  type: string
}

interface PipelineStepLogsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  pipelineNumber: number
  stepName: string
  stepStatus: string
}

export function PipelineStepLogs({
  open,
  onOpenChange,
  projectId,
  pipelineNumber,
  stepName,
  stepStatus,
}: PipelineStepLogsProps) {
  const t = useTranslations('pipeline')
  const [logs, setLogs] = useState<LogLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  const fetchLogs = async () => {
    if (fetched) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ci/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, pipelineNumber, stepName }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('fetchLogsFailed'))
      }

      const data = await res.json()
      setLogs(data.logs || [])
      setFetched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchLogsFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      // Reset on close
      setLogs([])
      setError(null)
      setFetched(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Step Logs: {stepName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Pipeline #{pipelineNumber}
            <Badge
              variant={
                stepStatus === 'success'
                  ? 'default'
                  : stepStatus === 'failure' || stepStatus === 'error'
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-[10px]"
            >
              {stepStatus}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] max-h-[60vh] overflow-y-auto bg-black/5 dark:bg-white/5 rounded-lg p-4 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
<Button variant="outline" size="sm" onClick={fetchLogs}>
                 {t('retry')}
               </Button>
            </div>
          ) : logs.length === 0 && !fetched ? (
            <div className="flex items-center justify-center h-full">
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <Terminal className="h-4 w-4 mr-2" />
                {t('loading')}
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('noLogs')}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-all">
              {logs.map((line, i) => {
                const timestamp = line.time
                  ? new Date(line.time * 1000).toISOString().slice(11, 19)
                  : ''
                const colorClass =
                  line.type === 'error'
                    ? 'text-red-500'
                    : line.type === 'warning'
                    ? 'text-yellow-500'
                    : ''

                return (
                  <div key={i} className={`${colorClass} hover:bg-foreground/5`}>
                    {timestamp && (
                      <span className="text-muted-foreground mr-2 select-none">
                        {timestamp}
                      </span>
                    )}
                    {line.line}
                  </div>
                )
              })}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
