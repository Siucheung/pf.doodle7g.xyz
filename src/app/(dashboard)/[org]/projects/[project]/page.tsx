import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { DEPLOYMENT_STATUSES, PROJECT_STATUSES } from '@/lib/constants'
import { DeleteProjectButton } from './delete-button'
import { cn } from '@/lib/utils'
import type { Deployment, Monitor, LogEntry, Incident } from '@/lib/db-types'

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

  // Fetch related data
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
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>
}) {
  const { org, project } = await params
  const data = await getProject(org, project)

  if (!data) {
    redirect('/login')
  }

  const { project: proj, deployments, monitors, logs, incidents } = data

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Project Header */}
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
              Created {formatDistanceToNow(new Date(proj.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" >
              <Link href={`/${org}/projects`}>
                Back to Projects
              </Link>
            </Button>
            <DeleteProjectButton projectId={proj.id} orgSlug={org} />
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="deployments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deployments">
              Deployments
              {deployments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {deployments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monitors">
              Monitors
              {monitors.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {monitors.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs">
              Logs
              {logs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="incidents">
              Incidents
              {incidents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {incidents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Deployments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deployments.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deployments.filter((d: Deployment) => d.status === 'success').length} successful
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Monitors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {monitors.filter((m) => m.enabled).length}/{monitors.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {monitors.length > 0 ? 'Running' : 'No monitors'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Incidents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{incidents.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {incidents.filter((i) => i.severity === 'critical').length} critical
                  </p>
                </CardContent>
              </Card>
            </div>

            {deployments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deployments</CardTitle>
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
                              {deployment.commit_message || deployment.branch || 'Deployment'}
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

          {/* Deployments Tab */}
          <TabsContent value="deployments">
            <Card>
              <CardHeader>
                <CardTitle>Deployments</CardTitle>
                <CardDescription>Deployment history for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {deployments.length === 0 ? (
                  <EmptyState
                    icon={<Rocket className="h-8 w-8" />}
                    title="No deployments yet"
                    description="Deployments will appear here once you trigger them"
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
                              {deployment.commit_message || deployment.branch || 'Deployment'}
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
                              <span>by {deployment.actor.full_name}</span>
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

          {/* Monitors Tab */}
          <TabsContent value="monitors">
            <Card>
              <CardHeader>
                <CardTitle>Monitors</CardTitle>
                <CardDescription>Uptime monitoring for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {monitors.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-8 w-8" />}
                    title="No monitors configured"
                    description="Set up monitors to track your endpoint health"
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
                              Every {monitor.interval_seconds}s · Expects {monitor.expected_status}
                            </p>
                          </div>
                        </div>
                        <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                          {monitor.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Logs</CardTitle>
                <CardDescription>Recent log entries</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <EmptyState
                    icon={<ScrollText className="h-8 w-8" />}
                    title="No logs yet"
                    description="Logs will appear here when your project generates output"
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

          {/* Incidents Tab */}
          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <CardTitle>Incidents</CardTitle>
                <CardDescription>Issues affecting this project</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-8 w-8" />}
                    title="No active incidents"
                    description="This project has no open incidents"
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
