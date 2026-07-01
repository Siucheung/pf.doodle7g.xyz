'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CI_PIPELINE_STATUSES } from '@/lib/constants'
import { PipelineStepLogs } from './pipeline-step-logs'
import type { CiPipeline } from '@/lib/db-types'

interface PipelineListProps {
  pipelines: CiPipeline[]
}

export function PipelineList({ pipelines }: PipelineListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<{
    projectId: string
    pipelineNumber: number
    stepName: string
    stepStatus: string
  } | null>(null)

  const handleStepClick = (
    pipeline: CiPipeline,
    stepName: string,
    stepStatus: string
  ) => {
    setSelectedPipeline({
      projectId: pipeline.project_id,
      pipelineNumber: pipeline.pipeline_number,
      stepName,
      stepStatus,
    })
    setDialogOpen(true)
  }

  return (
    <>
      <div className="space-y-3">
        {pipelines.map((pipeline) => (
          <div
            key={pipeline.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  #{pipeline.pipeline_number}{' '}
                  {pipeline.commit_message || pipeline.branch || 'Deployment'}
                </p>
                <Badge
                  variant={
                    pipeline.status === 'success'
                      ? 'default'
                      : pipeline.status === 'failure' || pipeline.status === 'error'
                      ? 'destructive'
                      : pipeline.status === 'running'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {CI_PIPELINE_STATUSES[pipeline.status as keyof typeof CI_PIPELINE_STATUSES] || pipeline.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {pipeline.event && (
                  <span className="capitalize">{pipeline.event}</span>
                )}
                {pipeline.branch && <span>{pipeline.branch}</span>}
                {pipeline.commit_sha && (
                  <span className="font-mono">{pipeline.commit_sha.slice(0, 7)}</span>
                )}
                <span>
                  {new Date(pipeline.created_at).toLocaleDateString()}
                </span>
                {pipeline.duration_ms && (
                  <span>{(pipeline.duration_ms / 1000).toFixed(1)}s</span>
                )}
              </div>
              {pipeline.steps && pipeline.steps.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  {(pipeline.steps as Array<{ name: string; status: string }>).map((step, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleStepClick(pipeline, step.name, step.status)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Badge
                        variant={
                          step.status === 'success'
                            ? 'default'
                            : step.status === 'failure' || step.status === 'error'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px] px-2 py-0"
                      >
                        {step.name.split('/').pop()}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPipeline && (
        <PipelineStepLogs
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          projectId={selectedPipeline.projectId}
          pipelineNumber={selectedPipeline.pipelineNumber}
          stepName={selectedPipeline.stepName}
          stepStatus={selectedPipeline.stepStatus}
        />
      )}
    </>
  )
}
