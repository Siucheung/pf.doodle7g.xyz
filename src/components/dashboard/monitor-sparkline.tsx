'use client'

import { useState, useEffect } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Loader2 } from 'lucide-react'

interface CheckData {
  id: number
  monitor_id: string
  status_code: number | null
  response_time_ms: number | null
  status: string
  error_message: string | null
  checked_at: string
}

interface MonitorSparklineProps {
  monitorId: string
}

export function MonitorSparkline({ monitorId }: MonitorSparklineProps) {
  const [data, setData] = useState<CheckData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChecks = async () => {
      try {
        const res = await fetch(`/api/monitors/${monitorId}/checks?limit=30`)
        if (res.ok) {
          const checks = await res.json()
          setData(checks || [])
        }
      } catch {
        // silently fail — sparkline is non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchChecks()
  }, [monitorId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-12">
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    )
  }

  const hasResponseTime = data.some((d) => d.response_time_ms != null)
  if (!hasResponseTime) {
    // Fallback: show status dots instead
    const upCount = data.filter((d) => d.status === 'up').length
    const pct = Math.round((upCount / data.length) * 100)
    return (
      <div className="flex items-center justify-center h-12 gap-2">
        <div className="flex items-center gap-0.5">
          {data.slice(-20).map((d, i) => (
            <div
              key={i}
              className={`h-3 w-1 rounded-sm ${
                d.status === 'up'
                  ? 'bg-green-500'
                  : d.status === 'down'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
    )
  }

  return (
    <div className="h-12">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`gradient-${monitorId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
            }}
            labelFormatter={(label: any) => {
              const d = data[label as number]
              if (!d) return ''
              return new Date(d.checked_at).toLocaleTimeString()
            }}
            formatter={(value: any) => [`${value || 0}ms`, '响应时间']}
          />
          <Area
            type="monotone"
            dataKey="response_time_ms"
            stroke="hsl(var(--primary))"
            fill={`url(#gradient-${monitorId})`}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
