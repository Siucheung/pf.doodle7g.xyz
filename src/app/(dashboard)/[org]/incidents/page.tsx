import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Plus, AlertTriangle, Search} from 'lucide-react'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {getTranslations} from 'next-intl/server'
import type {Incident} from '@/lib/db-types'
import { IncidentSeverityBadge, IncidentStatusBadge } from '@/components/dashboard/incident-badges'

async function getIncidents(orgId: string, status?: string, severity?: string, search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('incidents')
    .select('*, projects!inner(name, slug), monitors(name)')
    .eq('organization_id', orgId)
    .order('created_at', {ascending: false })

  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)
  if (search) query = query.ilike('title', `%${search}%`)

  const {data} = await query
  return data || []
}

export default async function IncidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const {org} = await params
  const sp = await searchParams
  const supabase = await createClient()
  const t = await getTranslations('incidents')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const status = typeof sp.status === 'string' ? sp.status : ''
  const severity = typeof sp.severity === 'string' ? sp.severity : ''
  const search = typeof sp.search === 'string' ? sp.search : ''
  const incidents = await getIncidents(orgData.id, status, severity, search)

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'acknowledged'
  )
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved')

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
          <Link
            href={`/${org}/incidents/new`}
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground hover:bg-primary/80 h-9 px-3 py-2 text-sm font-medium gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {t('createIncident')}
          </Link>
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder={t('searchLogs', {default: '搜索...'})}
              className="pl-8"
              defaultValue={search}
            />
          </div>
          <Select name="status" defaultValue={status}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('status', {default: '状态'})} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('status', {default: '全部状态'})}</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="muted">Muted</SelectItem>
            </SelectContent>
          </Select>
          <Select name="severity" defaultValue={severity}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('severity', {default: '严重程度'})} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('severity', {default: '全部级别'})}</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          {(status || severity || search) && (
            <Link href={`/${org}/incidents`} className="text-sm text-muted-foreground hover:text-foreground">
              清除筛选
            </Link>
          )}
        </form>

        {activeIncidents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {t('activeIncidents')}
              <Badge variant="destructive">{activeIncidents.length}</Badge>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {activeIncidents.map((incident: Incident) => (
                <Link
                  key={incident.id}
                  href={`/${org}/incidents/${incident.id}`}
                  className="block"
                >
                  <Card className="h-full transition-colors hover:border-primary/50 border-destructive/20">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <IncidentSeverityBadge severity={incident.severity} />
                        <IncidentStatusBadge status={incident.status} />
                      </div>
                      <CardTitle className="mt-2">{incident.title}</CardTitle>
                      {incident.description && (
                        <CardDescription className="line-clamp-2">
                          {incident.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        {incident.project && (
                          <span>{incident.project.name}</span>
                        )}
                        <span>
                          {formatDistanceToNow(new Date(incident.created_at), {addSuffix: true})}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {resolvedIncidents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('resolved')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {resolvedIncidents.map((incident: Incident) => (
                <Link
                  key={incident.id}
                  href={`/${org}/incidents/${incident.id}`}
                  className="block"
                >
                  <Card className="h-full transition-colors hover:border-primary/50 opacity-75">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <IncidentSeverityBadge severity={incident.severity} />
                        <IncidentStatusBadge status={incident.status} />
                      </div>
                      <CardTitle className="mt-2">{incident.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        {incident.project && (
                          <span>{incident.project.name}</span>
                        )}
                        <span>
                          {formatDistanceToNow(new Date(incident.created_at), {addSuffix: true})}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {incidents.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noIncidents')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('incidentsDesc')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}


