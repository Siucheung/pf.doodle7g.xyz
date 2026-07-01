'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { IncidentStatusBadge } from '@/components/dashboard/incident-badges'

export function IncidentActions({
  incidentId,
  org,
  status,
}: {
  incidentId: string
  org: string
  status: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const patch = async (newStatus: string) => {
    const res = await fetch(`/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || '操作失败')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex gap-2">
      {status === 'open' && (
        <Button onClick={() => patch('acknowledged')} disabled={isPending}>
          确认
        </Button>
      )}
      {status !== 'resolved' && status !== 'muted' && (
        <Button variant="outline" onClick={() => patch('resolved')} disabled={isPending}>
          解决
        </Button>
      )}
    </div>
  )
}
