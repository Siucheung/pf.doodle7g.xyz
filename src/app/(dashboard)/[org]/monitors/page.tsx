import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Plus, Activity, ExternalLink, ShieldCheck} from 'lucide-react'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {getTranslations} from 'next-intl/server'
import type {Monitor} from '@/lib/db-types'
import {MonitorSparkline} from '@/components/dashboard/monitor-sparkline'
import {cn} from '@/lib/utils'
import {AddMonitorDialog} from '@/components/dashboard/add-monitor-dialog'

async function getMonitors(orgId: string) {
  const supabase = await createClient()

  const {data} = await supabase
    .from('monitors')
    .select('*, project:projects(name, slug)')
    .eq('organization_id', orgId)
    .order('created_at', {ascending: false })

  return data || []
}

export default async function MonitorsPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const supabase = await createClient()
  const t = await getTranslations('monitors')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const monitors = await getMonitors(orgData.id)

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <AddMonitorDialog orgId={orgData.id} />
        </div>

        {/* Gatus 基础设施健康看板入口 */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t('gotoGatus')}</p>
                <p className="text-sm text-muted-foreground">{t('gatusDesc')}</p>
              </div>
            </div>
            <a
              href="http://localhost:8080"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {t('openGatus')}
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        {monitors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noMonitors')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('monitorsDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {monitors.map((monitor: Monitor) => (
              <Card key={monitor.id} className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            monitor.enabled ? 'bg-green-500' : 'bg-gray-400'
                          )}
                        />
                        <Link href={`/${org}/monitors/${monitor.id}`} className="hover:underline">
                          {monitor.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {monitor.url}
                      </CardDescription>
                    </div>
                    <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                      {monitor.enabled ? t('active') : t('paused')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('method')}</span>
                    <span className="font-mono">{monitor.method}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('expectedStatus')}</span>
                    <span className="font-mono">{monitor.expected_status}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('interval')}</span>
                    <span>{monitor.interval_seconds}s</span>
                  </div>
                  {monitor.project && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('project')}</span>
                      <Link
                        href={`/${org}/projects/${monitor.project.slug}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {monitor.project.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {t('created', {default: 'Created'})} {formatDistanceToNow(new Date(monitor.created_at), {addSuffix: true})}
                  </div>
                  {/* Mini sparkline chart */}
                  <MonitorSparkline monitorId={monitor.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
