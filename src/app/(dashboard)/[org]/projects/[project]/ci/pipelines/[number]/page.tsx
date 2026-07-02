import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { ArrowLeft } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { getTranslations } from 'next-intl/server'
import {
  PipelineActionButtons,
  ClientLogButton,
} from '@/components/dashboard/pipeline-detail-actions'
import { CI_PIPELINE_STATUSES } from '@/lib/constants'
import type { CiPipeline } from '@/lib/db-types'

async function getPipelineData(orgSlug: string, projectId: string, number: string) {
  const supabase = await createClient()
  const pipelineNumber = parseInt(number)

  if (isNaN(pipelineNumber)) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug, organization_id')
    .eq('id', projectId)
    .eq('organization_id', org.id)
    .single()

  if (!project) return null

  const { data: pipeline } = await supabase
    .from('ci_pipelines')
    .select('*')
    .eq('project_id', projectId)
    .eq('pipeline_number', pipelineNumber)
    .single()

  if (!pipeline) return null

  return { project, pipeline: pipeline as CiPipeline }
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'success'
      ? ('default' as const)
      : ['failure', 'error'].includes(status)
        ? ('destructive' as const)
        : status === 'running'
          ? ('secondary' as const)
          : ('outline' as const)

  return (
    <Badge variant={variant}>
      {CI_PIPELINE_STATUSES[status as keyof typeof CI_PIPELINE_STATUSES] || status}
    </Badge>
  )
}

function StepStatusIcon({ status }: { status: string }) {
  const color =
    status === 'success'
      ? 'text-green-500'
      : ['failure', 'error'].includes(status)
        ? 'text-red-500'
        : status === 'running' || status === 'pending'
          ? 'text-yellow-500'
          : 'text-gray-400'

  return (
    <div
      className={`h-3 w-3 rounded-full ${color} ${status === 'running' ? 'animate-pulse' : ''}`}
    />
  )
}

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ org: string; projectId: string; number: string }>
}) {
  const { org: orgSlug, projectId, number } = await params
  const data = await getPipelineData(orgSlug, projectId, number)

  if (!data) {
    redirect('/login')
  }

  const { project, pipeline } = data
  const t = await getTranslations('pipeline')

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="container mx-auto p-6 space-y-6">
        {/* Back + Actions row */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${orgSlug}/projects/${project.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back', { default: 'Back to Project' })}
          </Link>
          <PipelineActionButtons pipeline={pipeline} projectId={projectId} />
        </div>

        {/* Pipeline Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {t('pipelineNumber', { default: 'Pipeline #' })}
                  {pipeline.pipeline_number}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {pipeline.commit_message || pipeline.branch || ''}
                </p>
              </div>
              <StatusBadge status={pipeline.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {t('branch', { default: 'Branch' })}
                </p>
                <p className="font-medium font-mono">
                  {pipeline.branch || '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('commit', { default: 'Commit' })}
                </p>
                <p className="font-medium font-mono">
                  {pipeline.commit_sha
                    ? pipeline.commit_sha.slice(0, 7)
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('author', { default: 'Author' })}
                </p>
                <p className="font-medium">
                  {pipeline.author || '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('event', { default: 'Event' })}
                </p>
                <p className="font-medium capitalize">
                  {pipeline.event || '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('duration', { default: 'Duration' })}
                </p>
                <p className="font-medium">
                  {pipeline.duration_ms
                    ? `${(pipeline.duration_ms / 1000).toFixed(1)}s`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('created', { default: 'Created' })}
                </p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(pipeline.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps / Workflow Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('steps', { default: 'Steps' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.steps && pipeline.steps.length > 0 ? (
              <div className="space-y-2">
                {pipeline.steps.map(
                  (
                    step: {
                      name: string
                      status: string
                      duration_ms?: number | null
                    },
                    i: number
                  ) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <StepStatusIcon status={step.status} />
                        <div>
                          <p className="text-sm font-medium">
                            {step.name.split('/').pop()}
                          </p>
                          {step.duration_ms && (
                            <p className="text-xs text-muted-foreground">
                              {(step.duration_ms / 1000).toFixed(1)}s
                            </p>
                          )}
                        </div>
                      </div>
                      <ClientLogButton
                        pipeline={pipeline}
                        stepName={step.name}
                        stepStatus={step.status}
                        projectId={projectId}
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('noSteps', { default: 'No step data available' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
