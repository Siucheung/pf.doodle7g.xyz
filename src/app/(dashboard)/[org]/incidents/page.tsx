import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Plus, AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {INCIDENT_SEVERITIES, INCIDENT_STATUSES} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'
import type {Incident} from '@/lib/db-types'

async function getIncidents(orgId: string) {
  const supabase = await createClient()

  const {data} = await supabase
    .from('incidents')
    .select('*, project:projects(name, slug)')
    .eq('organization_id', orgId)
    .order('created_at', {ascending: false })

  return data || []
}

export default async function IncidentsPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
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

  const incidents = await getIncidents(orgData.id)

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
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('createIncident')}
          </Button>
        </div>

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

function IncidentSeverityBadge({severity}: {severity: string}) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
    critical: 'destructive',
    warning: 'default',
    info: 'secondary',
  }

  return (
    <Badge variant={variants[severity] || 'secondary'}>
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
    <Badge variant={variants[status] || 'outline'}>
      {INCIDENT_STATUSES[status as keyof typeof INCIDENT_STATUSES] || status}
    </Badge>
  )
}
