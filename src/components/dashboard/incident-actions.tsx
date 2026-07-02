'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('incidents')
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
      alert(data.error || t('operationFailed'))
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex gap-2">
      {status === 'open' && (
        <Button onClick={() => patch('acknowledged')} disabled={isPending}>
          {t('acknowledge')}
        </Button>
      )}
      {status !== 'resolved' && status !== 'muted' && (
        <Button variant="outline" onClick={() => patch('resolved')} disabled={isPending}>
          {t('resolve')}
        </Button>
      )}
    </div>
  )
}
