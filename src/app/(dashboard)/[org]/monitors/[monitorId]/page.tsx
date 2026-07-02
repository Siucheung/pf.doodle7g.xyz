import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { ArrowLeft } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { getTranslations } from 'next-intl/server'
import { MonitorSparkline } from '@/components/dashboard/monitor-sparkline'
import { EditMonitorDialog } from '@/components/dashboard/edit-monitor-dialog'
import {
  IncidentStatusBadge,
  IncidentSeverityBadge,
} from '@/components/dashboard/incident-badges'

async function getMonitorData(orgSlug: string, monitorId: string) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const { data: monitor } = await supabase
    .from('monitors')
    .select('*, project:projects(name, slug)')
    .eq('id', monitorId)
    .eq('organization_id', org.id)
    .single()

  if (!monitor) return null

  const { data: checks } = await supabase
    .from('monitor_checks')
    .select('*')
    .eq('monitor_id', monitorId)
    .order('checked_at', { ascending: false })
    .limit(50)

  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, title, status, severity, created_at')
    .eq('monitor_id', monitorId)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    org,
    monitor,
    checks: checks || [],
    incidents: incidents || [],
  }
}

export default async function MonitorDetailPage({
  params,
}: {
  params: Promise<{ org: string; monitorId: string }>
}) {
  const { org, monitorId } = await params
  const data = await getMonitorData(org, monitorId)

  if (!data) {
    redirect('/login')
  }

  const { monitor, checks, incidents } = data
  const t = await getTranslations('monitors')
  const tCommon = await getTranslations('common')

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="container mx-auto p-6 space-y-6">
        {/* Header with back link and edit button */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${org}/monitors`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToIncidents', { default: 'Back to Monitors' })}
          </Link>
          <EditMonitorDialog monitor={monitor as any} />
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{monitor.name}</CardTitle>
                <CardDescription>{monitor.url}</CardDescription>
              </div>
              <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                {monitor.enabled
                  ? t('active', { default: 'Active' })
                  : t('paused', { default: 'Paused' })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {t('monitorMethod', { default: 'Method' })}
                </p>
                <p className="font-medium">{monitor.method}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('expectedStatusCode', { default: 'Expected Status' })}
                </p>
                <p className="font-medium">{monitor.expected_status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('checkInterval', { default: 'Interval' })}
                </p>
                <p className="font-medium">{monitor.interval_seconds}s</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {tCommon('created', { default: 'Created' })}
                </p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(monitor.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {(monitor as any).project && (
                <div>
                  <p className="text-muted-foreground">
                    {t('project', { default: 'Project' })}
                  </p>
                  <p className="font-medium">
                    <Link
                      href={`/${org}/projects/${(monitor as any).project.slug}`}
                      className="hover:underline"
                    >
                      {(monitor as any).project.name}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sparkline Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('responseTime', { default: 'Response Time' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonitorSparkline monitorId={monitorId} />
          </CardContent>
        </Card>

        {/* Checks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('lastChecks', { default: 'Recent Checks' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChecksTable checks={checks} t={t} tCommon={tCommon} />
          </CardContent>
        </Card>

        {/* Related Incidents */}
        {incidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t('relatedIncidents', { default: 'Related Incidents' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {incidents.map((inc: any) => (
                  <Link
                    key={inc.id}
                    href={`/${org}/incidents/${inc.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                  >
                    <span className="font-medium">{inc.title}</span>
                    <div className="flex items-center gap-2">
                      <IncidentStatusBadge status={inc.status} />
                      <IncidentSeverityBadge severity={inc.severity} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function ChecksTable({
  checks,
  t,
  tCommon,
}: {
  checks: any[]
  t: (key: string, opts?: { default?: string }) => string
  tCommon: (key: string, opts?: { default?: string }) => string
}) {
  if (!checks || checks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('noChecks', { default: 'No checks recorded yet' })}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 pr-4">
              {tCommon('time', { default: 'Time' })}
            </th>
            <th className="text-left py-2 pr-4">
              {t('lastChecks', { default: 'Status' })}
            </th>
            <th className="text-left py-2 pr-4">
              {t('statusCode', { default: 'Code' })}
            </th>
            <th className="text-left py-2 pr-4">
              {t('responseTime', { default: 'Response' })}
            </th>
            <th className="text-left py-2">
              {t('errorMessage', { default: 'Error' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check: any) => (
            <tr key={check.id} className="border-b last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap">
                {formatDistanceToNow(new Date(check.checked_at), {
                  addSuffix: true,
                })}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center gap-1 ${
                    check.status === 'up'
                      ? 'text-green-600'
                      : check.status === 'down'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      check.status === 'up'
                        ? 'bg-green-500'
                        : check.status === 'down'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  {check.status}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono">
                {check.status_code || '-'}
              </td>
              <td className="py-2 pr-4 font-mono">
                {check.response_time_ms
                  ? `${check.response_time_ms}ms`
                  : '-'}
              </td>
              <td className="py-2 text-muted-foreground max-w-[200px] truncate">
                {check.error_message || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
