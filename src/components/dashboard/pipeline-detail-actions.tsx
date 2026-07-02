'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play, Square, Loader2 } from 'lucide-react'
import { PipelineStepLogs } from './pipeline-step-logs'
import type { CiPipeline } from '@/lib/db-types'

export function PipelineActionButtons({
  pipeline,
  projectId,
}: {
  pipeline: CiPipeline
  projectId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const isRunning = pipeline.status === 'running' || pipeline.status === 'pending'

  const handleCancel = async () => {
    setLoading('cancel')
    try {
      await fetch(
        `/api/projects/${projectId}/ci/pipelines/${pipeline.pipeline_number}/cancel`,
        { method: 'POST' }
      )
      router.refresh()
    } catch (e) {
      console.error('Cancel failed:', e)
    } finally {
      setLoading(null)
    }
  }

  const handleRestart = async () => {
    setLoading('restart')
    try {
      await fetch(`/api/projects/${projectId}/ci/pipelines/${pipeline.pipeline_number}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      router.refresh()
    } catch (e) {
      console.error('Restart failed:', e)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isRunning && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleCancel}
          disabled={loading !== null}
        >
          {loading === 'cancel' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {' Cancel'}
        </Button>
      )}
      {!isRunning && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          disabled={loading !== null}
        >
          {loading === 'restart' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {' Restart'}
        </Button>
      )}
    </div>
  )
}

export function ClientLogButton({
  pipeline,
  stepName,
  stepStatus,
  projectId,
}: {
  pipeline: CiPipeline
  stepName: string
  stepStatus: string
  projectId: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        View Logs
      </Button>
      <PipelineStepLogs
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        pipelineNumber={pipeline.pipeline_number}
        stepName={stepName}
        stepStatus={stepStatus}
      />
    </>
  )
}
