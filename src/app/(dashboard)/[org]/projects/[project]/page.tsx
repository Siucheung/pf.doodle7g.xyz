import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  FolderOpen,
  GitBranch,
  Rocket,
  Activity,
  ScrollText,
  ExternalLink,
  PlayCircle,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { DEPLOYMENT_STATUSES, PROJECT_STATUSES, CI_PIPELINE_STATUSES } from '@/lib/constants'
import { DeleteProjectButton } from './delete-button'
import { cn } from '@/lib/utils'
import type { Deployment, Monitor, LogEntry, Incident, CiPipeline } from '@/lib/db-types'

async function getProject(orgSlug: string, projectSlug: string) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', org.id)
    .eq('slug', projectSlug)
    .single()

  if (!project) return null

  // 获取关联数据
  const ciPipelinesResult = await supabase
    .from('ci_pipelines')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const [deploymentsResult, monitorsResult, logsResult, incidentsResult] =
    await Promise.all([
      supabase
        .from('deployments')
        .select('*, actor:profiles(full_name)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('monitors')
        .select('*')
        .eq('project_id', project.id),
      supabase
        .from('logs')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('incidents')
        .select('*')
        .eq('project_id', project.id)
        .in('status', ['open', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  return {
    project,
    deployments: deploymentsResult.data || [],
    monitors: monitorsResult.data || [],
    logs: logsResult.data || [],
    incidents: incidentsResult.data || [],
    ciPipelines: ciPipelinesResult.data || [],
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>
}) {
  const { org, project } = await params
  const data = await getProject(org, project)
  const t = await getTranslations('projects')
  const st = await getTranslations('status')
  const secT = await getTranslations('secrets')

  if (!data) {
    redirect('/login')
  }

  const { project: proj, deployments, monitors, logs, incidents, ciPipelines } = data

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* 项目头部 */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{proj.name}</h1>
              <Badge
                variant={
                  proj.status === 'active'
                    ? 'default'
                    : proj.status === 'paused'
                    ? 'secondary'
                    : 'outline'
                }
              >
                {PROJECT_STATUSES[proj.status as keyof typeof PROJECT_STATUSES] || proj.status}
              </Badge>
            </div>
            {proj.description && (
              <p className="text-muted-foreground">{proj.description}</p>
            )}
            {proj.repository_url && (
              <a
                href={proj.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <GitBranch className="h-3.5 w-3.5" />
                {proj.repository_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              {t('created')} {formatDistanceToNow(new Date(proj.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" >
              <Link href={`/${org}/projects`}>
                {t('backToProjects')}
              </Link>
            </Button>
            <DeleteProjectButton projectId={proj.id} orgSlug={org} />
          </div>
        </div>

        <Separator />

        {/* Tab 标签页 */}
        <Tabs defaultValue="deployments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="deployments">
              {t('deployments')}
              {deployments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {deployments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monitors">
              {t('monitors')}
              {monitors.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {monitors.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs">
              {t('logs')}
              {logs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="incidents">
              {t('incidents')}
              {incidents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {incidents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="secrets">
              {t('secrets')}
            </TabsTrigger>
            <TabsTrigger value="ci">
              {t('ci')}
              {ciPipelines.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ciPipelines.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('totalDeployments')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deployments.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deployments.filter((d: Deployment) => d.status === 'success').length} {t('successful')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('activeMonitors')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {monitors.filter((m) => m.enabled).length}/{monitors.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {monitors.length > 0 ? t('running') : t('noMonitors')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('activeIncidents')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{incidents.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {incidents.filter((i) => i.severity === 'critical').length} {t('critical')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {deployments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('recentDeployments')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {deployments.slice(0, 5).map((deployment: Deployment) => (
                      <div
                        key={deployment.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {deployment.commit_message || deployment.branch || t('deployment')}
                            </p>
                            <Badge
                              variant={
                                deployment.status === 'success'
                                  ? 'default'
                                  : deployment.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {DEPLOYMENT_STATUSES[deployment.status as keyof typeof DEPLOYMENT_STATUSES] || deployment.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 部署标签页 */}
          <TabsContent value="deployments">
            <Card>
              <CardHeader>
                <CardTitle>{t('deployments')}</CardTitle>
                <CardDescription>{t('deploymentHistory')}</CardDescription>
              </CardHeader>
              <CardContent>
                {deployments.length === 0 ? (
                  <EmptyState
                    icon={<Rocket className="h-8 w-8" />}
                    title={t('noDeployments')}
                    description={t('noDeploymentsTriggered')}
                  />
                ) : (
                  <div className="space-y-3">
                    {deployments.map((deployment: Deployment) => (
                      <div
                        key={deployment.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {deployment.commit_message || deployment.branch || t('deployment')}
                            </p>
                            <Badge
                              variant={
                                deployment.status === 'success'
                                  ? 'default'
                                  : deployment.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {DEPLOYMENT_STATUSES[deployment.status as keyof typeof DEPLOYMENT_STATUSES] || deployment.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="capitalize">{deployment.environment}</span>
                            {deployment.commit_sha && (
                              <span className="font-mono">{deployment.commit_sha.slice(0, 7)}</span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                            </span>
                            {deployment.actor?.full_name && (
                              <span>{st('by')} {deployment.actor.full_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 监控标签页 */}
          <TabsContent value="monitors">
            <Card>
              <CardHeader>
                <CardTitle>{t('monitors')}</CardTitle>
                <CardDescription>{t('uptimeMonitoring')}</CardDescription>
              </CardHeader>
              <CardContent>
                {monitors.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-8 w-8" />}
                    title={st('noMonitorsConfigured')}
                    description={t('noMonitorsDesc')}
                  />
                ) : (
                  <div className="space-y-3">
                    {monitors.map((monitor: Monitor) => (
                      <div
                        key={monitor.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              monitor.enabled ? 'bg-green-500' : 'bg-gray-400'
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium">{monitor.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {monitor.method} {monitor.url}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {st('everyInterval', { seconds: monitor.interval_seconds, status: monitor.expected_status })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                          {monitor.enabled ? st('active') : st('paused')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 日志标签页 */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>{t('logs')}</CardTitle>
                <CardDescription>{t('recentLogEntries')}</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <EmptyState
                    icon={<ScrollText className="h-8 w-8" />}
                    title={t('noLogs')}
                    description={t('noLogsGenerated')}
                  />
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {logs.map((log: LogEntry) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 rounded-lg border p-3 font-mono text-xs"
                      >
                        <Badge
                          variant={
                            log.level === 'error'
                              ? 'destructive'
                              : log.level === 'warn'
                              ? 'default'
                              : 'secondary'
                          }
                          className="mt-0.5 shrink-0"
                        >
                          {log.level.toUpperCase()}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="break-all">{log.message}</p>
                          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            {log.source && <span>{log.source}</span>}
                            <span>·</span>
                            <span>
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 工单标签页 */}
          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <CardTitle>{t('incidents')}</CardTitle>
                <CardDescription>{t('issuesAffecting')}</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-8 w-8" />}
                    title={t('noIncidents')}
                    description={t('noActiveIncidentsDesc')}
                  />
                ) : (
                  <div className="space-y-3">
                    {incidents.map((incident: Incident) => (
                      <div
                        key={incident.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{incident.title}</p>
                            <Badge
                              variant={
                                incident.severity === 'critical'
                                  ? 'destructive'
                                  : incident.severity === 'warning'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {incident.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 密钥标签页 */}
          <TabsContent value="secrets">
            <Card>
              <CardHeader>
                <CardTitle>{t('secrets')}</CardTitle>
                <CardDescription>
                  {secT('description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-12">
                  <Link href={`/${org}/projects/${project.slug}/secrets`}>
                    <Button>
                      {secT('viewAllSecrets')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CI/CD 标签页 */}
          <TabsContent value="ci">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('ci')}</CardTitle>
                  <CardDescription>
                    {t('ciDesc')}
                  </CardDescription>
                </div>
                <Button>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {t('triggerPipeline')}
                </Button>
              </CardHeader>
              <CardContent>
                {ciPipelines.length === 0 ? (
                  <EmptyState
                    icon={<PlayCircle className="h-8 w-8" />}
                    title={t('noPipelines')}
                    description={t('noPipelinesDesc')}
                  />
                ) : (
                  <div className="space-y-3">
                    {ciPipelines.map((pipeline: CiPipeline) => (
                      <div
                        key={pipeline.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              #{pipeline.pipeline_number}{' '}
                              {pipeline.commit_message || pipeline.branch || t('deployment')}
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
                            {pipeline.branch && (
                              <span>{pipeline.branch}</span>
                            )}
                            {pipeline.commit_sha && (
                              <span className="font-mono">{pipeline.commit_sha.slice(0, 7)}</span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(pipeline.created_at), { addSuffix: true })}
                            </span>
                            {pipeline.duration_ms && (
                              <span>{(pipeline.duration_ms / 1000).toFixed(1)}s</span>
                            )}
                          </div>
                          {pipeline.steps && pipeline.steps.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              {(pipeline.steps as Array<{ name: string; status: string }>).map((step, i) => (
                                <Badge
                                  key={i}
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
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-3 rounded-full bg-muted mb-3 text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}
