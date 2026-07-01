import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {ArrowLeft} from 'lucide-react'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {INCIDENT_SEVERITIES, INCIDENT_STATUSES} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'
import type {IncidentEvent} from '@/lib/db-types'

async function getIncident(orgSlug: string, incidentId: string) {
  const supabase = await createClient()

  const {data: org} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const {data: incident} = await supabase
    .from('incidents')
    .select('*, project:projects(name, slug), monitor:monitors(name)')
    .eq('id', incidentId)
    .eq('organization_id', org.id)
    .single()

  if (!incident) return null

  const {data: events} = await supabase
    .from('incident_events')
    .select('*, actor:profiles(full_name)')
    .eq('incident_id', incidentId)
    .order('created_at', {ascending: false })

  return {incident, events: events || []}
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ org: string; incidentId: string }>
}) {
  const {org, incidentId} = await params
  const data = await getIncident(org, incidentId)

  if (!data) {
    redirect('/login')
  }

  const {incident, events} = data
  const t = await getTranslations('incidents')

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <Link
          href={`/${org}/incidents`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToIncidents')}
        </Link>

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IncidentSeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h1 className="text-2xl font-bold">{incident.title}</h1>
            {incident.description && (
              <p className="text-muted-foreground">{incident.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {incident.project && (
                <span>{t('project', {default: 'Project'})}: {incident.project.name}</span>
              )}
              {incident.monitor && (
                <span>{t('monitor', {default: 'Monitor'})}: {incident.monitor.name}</span>
              )}
              <span>
                {t('createdAt', {default: 'Created'})} {formatDistanceToNow(new Date(incident.created_at), {addSuffix: true})}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {incident.status === 'open' && (
              <Button>{t('acknowledge')}</Button>
            )}
            {incident.status !== 'resolved' && (
              <Button variant="outline">{t('resolve')}</Button>
            )}
          </div>
        </div>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>{t('timeline')}</CardTitle>
            <CardDescription>{t('timelineDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('noEvents')}
              </p>
            ) : (
              <div className="space-y-4">
                {events.map((event: IncidentEvent, index: number) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      {index < events.length - 1 && (
                        <div className="w-px h-full bg-border mt-1" />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <EventTypeBadge eventType={event.event_type} t={t} />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.created_at), {addSuffix: true})}
                        </span>
                      </div>
                      {event.actor?.full_name && (
                        <p className="text-sm mt-1">
                          by <span className="font-medium">{event.actor.full_name}</span>
                        </p>
                      )}
                      {event.old_value && event.new_value && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.old_value} → {event.new_value}
                        </p>
                      )}
                    </div>
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

function EventTypeBadge({eventType, t}: {eventType: string; t: (key: string) => string}) {
  const labels: Record<string, string> = {
    status_change: t('statusChanged'),
    comment: t('comment'),
    assignment: t('assignment'),
    trigger: t('triggered'),
  }

  return (
    <Badge variant="outline" className="text-xs">
      {labels[eventType] || eventType}
    </Badge>
  )
}
