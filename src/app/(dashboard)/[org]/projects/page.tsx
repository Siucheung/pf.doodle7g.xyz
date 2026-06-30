import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {FolderOpen, GitBranch, Clock, Plus} from 'lucide-react'
import Link from 'next/link'
import {formatDistanceToNow} from 'date-fns'
import {PROJECT_STATUSES} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'
import type {Project} from '@/lib/db-types'

async function getProjects(orgId: string) {
  const supabase = await createClient()

  const {data, error} = await supabase
    .from('projects')
    .select('*, deployments(count)')
    .eq('organization_id', orgId)
    .order('updated_at', {ascending: false})

  if (error) {
    return []
  }

  return data || []
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const supabase = await createClient()
  const t = await getTranslations('projects')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const projects = await getProjects(orgData.id)

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
            <Link href={`/${org}/projects/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noProjects')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('noProjectsDesc')}
              </p>
              <Button>
                <Link href={`/${org}/projects/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createProject')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project) => (
              <Link
                key={project.id}
                href={`/${org}/projects/${project.slug}`}
                className="block"
              >
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          {project.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {project.description || t('noDescription', {default: 'No description'})}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          project.status === 'active'
                            ? 'default'
                            : project.status === 'paused'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {PROJECT_STATUSES[project.status as keyof typeof PROJECT_STATUSES] || project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {project.repository_url && (
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[150px]">
                            {project.repository_url.split('/').pop()?.replace('.git', '')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {formatDistanceToNow(new Date(project.updated_at), {addSuffix: true})}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
