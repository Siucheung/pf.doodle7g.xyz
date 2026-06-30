import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Rocket} from 'lucide-react'
import {cn} from '@/lib/utils'
import {formatDistanceToNow} from 'date-fns'
import {DEPLOYMENT_STATUSES} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'
import type {Deployment} from '@/lib/db-types'

async function getDeployments(orgId: string) {
  const supabase = await createClient()

  const result = await supabase
    .from('deployments')
    .select('*, project:projects(name, slug), actor:profiles(full_name)')
    .eq('organization_id', orgId)
    .order('created_at', {ascending: false })
    .limit(50)

  return (result.data as Deployment[]) || []
}

export default async function DeploymentsPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const supabase = await createClient()
  const t = await getTranslations('deployments')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData?.id) {
    redirect('/login')
  }

  const deployments = await getDeployments(orgData.id)

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
        </div>

        {deployments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Rocket className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noDeployments')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('deploymentsDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {deployments.map((deployment: Deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-2 w-2 rounded-full',
                          deployment.status === 'success' ? 'bg-green-500' :
                            deployment.status === 'failed' ? 'bg-red-500' :
                              deployment.status === 'building' ? 'bg-yellow-500 animate-pulse' :
                                'bg-gray-400'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {deployment.project?.name || 'Unknown'}
                            </p>
                            <Badge variant="outline" className="capitalize">
                              {deployment.environment}
                            </Badge>
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
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {deployment.commit_message || deployment.branch || 'No details'}
                          </p>
                          {deployment.commit_sha && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {deployment.commit_sha.slice(0, 7)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(deployment.created_at), {addSuffix: true})}
                      </p>
                      {deployment.actor?.full_name && (
                        <p className="text-xs text-muted-foreground">
                          by {deployment.actor.full_name}
                        </p>
                      )}
                      {deployment.duration_ms && (
                        <p className="text-xs text-muted-foreground">
                          {(deployment.duration_ms / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

