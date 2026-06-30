import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {
  Key,
  Plus,
  ExternalLink,
  Copy,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import {getTranslations} from 'next-intl/server'

/**
 * 从内部 API 获取项目在 Infisical 中的所有密钥。
 * 返回 null 表示 Infisical 未配置，返回空数组表示已配置但无密钥。
 */
async function getSecrets(projectId: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}/secrets`,
    {cache: 'no-store'}
  )

  if (!response.ok) {
    return null
  }

  const result = await response.json()
  return result.secrets || []
}

export default async function SecretsPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>
}) {
  const {org, project} = await params
  const supabase = await createClient()
  const t = await getTranslations('secrets')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const {data: projectData} = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', orgData.id)
    .eq('slug', project)
    .single()

  if (!projectData) {
    redirect('/login')
  }

  const secrets = await getSecrets(projectData.id)
  const hasInfisical = secrets !== null

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          {hasInfisical && (
            <div className="flex gap-2">
              <Button variant="outline">
                <a
                  href={`${process.env.NEXT_PUBLIC_INFISICAL_URL}/projects/${projectData.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Infisical
                </a>
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Secret
              </Button>
            </div>
          )}
        </div>

        {!hasInfisical ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('notConfigured')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('notConfiguredDesc')}
              </p>
              <Button variant="outline">
                <Link href={`/${org}/settings`}>
                  Configure Infisical
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : secrets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noSecrets')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('noSecretsDesc')}
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Secret
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Secrets</CardTitle>
              <CardDescription>
                {secrets.length} secret{secrets.length !== 1 ? 's' : ''} in this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {secrets.map((secret: {id: string; key: string; value: string; type: string; environment: string; folder: string}) => (
                  <div
                    key={secret.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium font-mono">{secret.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {secret.environment} · {secret.folder || '/'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={secret.type === 'shared' ? 'default' : 'secondary'}>
                        {secret.type}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
