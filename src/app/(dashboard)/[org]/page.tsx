import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {FolderOpen, Rocket, AlertTriangle, Activity} from 'lucide-react'
import {DEPLOYMENT_STATUSES, INCIDENT_SEVERITIES} from '@/lib/constants'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {getTranslations} from 'next-intl/server'
import {cn} from '@/lib/utils'

async function getDashboardData(orgId: string) {
  const supabase = await createClient()

  const [projectsResult, deploymentsResult, incidentsResult, monitorsResult] =
    await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', {ascending: false})
        .limit(6),
      supabase
        .from('deployments')
        .select('*, project:projects(name, slug), actor:profiles(full_name)')
        .eq('organization_id', orgId)
        .order('created_at', {ascending: false})
        .limit(10),
      supabase
        .from('incidents')
        .select('*, project:projects(name, slug)')
        .eq('organization_id', orgId)
        .in('status', ['open', 'acknowledged'])
        .order('severity', {ascending: false})
        .limit(5),
      supabase
        .from('monitors')
        .select('*, project:projects(name, slug)')
        .eq('organization_id', orgId)
        .limit(5),
    ])

  return {
    projects: projectsResult.data || [],
    deployments: deploymentsResult.data || [],
    incidents: incidentsResult.data || [],
    monitors: monitorsResult.data || [],
  }
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const supabase = await createClient()
  const t = await getTranslations('status')
  const tNav = await getTranslations('nav')
  const tCommon = await getTranslations('common')
  const tDeployments = await getTranslations('deployments')
  const tProjects = await getTranslations('projects')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const data = await getDashboardData(orgData.id)

  // Calculate stats
  const activeProjects = data.projects.filter((p) => p.status === 'active').length
  const recentDeployments = data.deployments.filter((d) =>
    ['pending', 'building'].includes(d.status)
  ).length
  const activeIncidents = data.incidents.length
  const criticalIncidents = data.incidents.filter((i) => i.severity === 'critical').length

  const uptime = data.monitors.length > 0
    ? Math.round((data.monitors.filter((m) => m.enabled).length / data.monitors.length) * 100)
    : 100

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={tNav('projects')}
            value={String(data.projects.length)}
            subtitle={`${activeProjects} ${t('active')}`}
            icon={<FolderOpen className="h-4 w-4" />}
            href={`/${org}/projects`}
          />
          <StatCard
            title={tNav('deployments')}
            value={String(data.deployments.length)}
            subtitle={`${recentDeployments} ${t('inProgress')}`}
            icon={<Rocket className="h-4 w-4" />}
            href={`/${org}/deployments`}
          />
          <StatCard
            title={t('activeIncidents')}
            value={String(activeIncidents)}
            subtitle={criticalIncidents > 0 ? `${criticalIncidents} ${t('critical')}` : t('noneCritical')}
            icon={<AlertTriangle className="h-4 w-4" />}
            href={`/${org}/incidents`}
            alert={criticalIncidents > 0}
          />
          <StatCard
            title={t('uptime')}
            value={`${uptime}%`}
            subtitle={`${data.monitors.length} ${t('monitors')}`}
            icon={<Activity className="h-4 w-4" />}
            href={`/${org}/monitors`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Deployments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('recentDeployments')}</CardTitle>
                  <CardDescription>{t('deploymentActivity')}</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  <Link href={`/${org}/deployments`}>{t('viewAll')}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.deployments.length === 0 ? (
                <EmptyState
                  icon={<Rocket className="h-8 w-8" />}
                  title={tDeployments('noDeployments')}
                  description={tDeployments('deploymentsDesc')}
                />
              ) : (
                <div className="space-y-3">
                  {data.deployments.slice(0, 5).map((deployment) => (
                    <div
                      key={deployment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {deployment.project?.name || tCommon('unknown')}
                          </p>
                          <DeploymentStatusBadge status={deployment.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {deployment.commit_message || deployment.branch || tProjects('noDescription')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(deployment.created_at), {addSuffix: true})}
                          {deployment.actor?.full_name && ` ${tDeployments('by')} ${deployment.actor.full_name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Incidents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('activeIncidents')}</CardTitle>
                  <CardDescription>{t('allSystemsRunning')}</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  <Link href={`/${org}/incidents`}>{t('viewAll')}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.incidents.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle className="h-8 w-8" />}
                  title={t('noActiveIncidents')}
                  description={t('allSystemsRunning')}
                />
              ) : (
                <div className="space-y-3">
                  {data.incidents.map((incident) => (
                    <Link
                      key={incident.id}
                      href={`/${org}/incidents/${incident.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <IncidentSeverityBadge severity={incident.severity} />
                          <IncidentStatusBadge status={incident.status} />
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">{incident.title}</p>
                        {incident.project && (
                          <p className="text-xs text-muted-foreground">
                            {incident.project.name}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monitor Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('monitorStatus')}</CardTitle>
                <CardDescription>{t('healthEndpoints')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                <Link href={`/${org}/monitors`}>{t('viewAll')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.monitors.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                title={t('noMonitorsConfigured')}
                description={t('setupMonitors')}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.monitors.map((monitor) => (
                  <div
                    key={monitor.id}
                    className="flex items-center justify-between rounded-lg border p-4"
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
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {monitor.url}
                        </p>
                      </div>
                    </div>
                    <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                      {monitor.enabled ? t('active') : t('paused')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  href,
  alert,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  href: string
  alert?: boolean
}) {
  return (
    <Link href={href}>
      <Card className={cn('transition-colors hover:border-primary/50', alert && 'border-destructive/50')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={cn('text-2xl font-bold', alert && 'text-destructive')}>{value}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className={cn('p-2 rounded-lg bg-muted', alert && 'bg-destructive/10')}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function DeploymentStatusBadge({status}: {status: string}) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    building: 'secondary',
    success: 'default',
    failed: 'destructive',
    cancelled: 'outline',
  }

  return (
    <Badge variant={variants[status] || 'outline'} className="text-xs">
      {DEPLOYMENT_STATUSES[status as keyof typeof DEPLOYMENT_STATUSES] || status}
    </Badge>
  )
}

function IncidentSeverityBadge({severity}: {severity: string}) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
    critical: 'destructive',
    warning: 'default',
    info: 'secondary',
  }

  return (
    <Badge variant={variants[severity] || 'secondary'} className="text-xs">
      {INCIDENT_SEVERITIES[severity as keyof typeof INCIDENT_SEVERITIES] || severity}
    </Badge>
  )
}

function IncidentStatusBadge({status}: {status: string}) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    open: 'destructive',
    acknowledged: 'default',
    resolved: 'secondary',
    muted: 'outline',
  }

  return (
    <Badge variant={variants[status] || 'outline'} className="text-xs">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
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
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-muted mb-3 text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}
