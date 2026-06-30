import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Separator} from '@/components/ui/separator'
import {Building2, Shield, Globe} from 'lucide-react'
import {notFound} from 'next/navigation'
import {DEPLOYMENT_ENVIRONMENTS, PLANS} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'

async function getOrgData(orgSlug: string) {
  const supabase = await createClient()

  const {data: org} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const {data: members} = await supabase
    .from('organization_members')
    .select('*, profile:profiles(*)')
    .eq('organization_id', org.id)

  const {data: projects} = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', org.id)

  return {org, members: members || [], projects: projects || []}
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const data = await getOrgData(org)

  if (!data) {
    notFound()
  }

  const {org: orgData, members, projects} = data
  const t = await getTranslations('settings')

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div className="grid gap-6 max-w-3xl">
          {/* Organization Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>{t('organization')}</CardTitle>
              </div>
              <CardDescription>
                {t('orgInfo')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input id="name" defaultValue={orgData.name} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">{t('slug')}</Label>
                <Input id="slug" defaultValue={orgData.slug} disabled />
                <p className="text-xs text-muted-foreground">
                  {t('slugNote')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">{t('plan')}</Label>
                <Input
                  id="plan"
                  defaultValue={PLANS[orgData.plan as keyof typeof PLANS] || orgData.plan}
                  disabled
                />
              </div>
              <Button>{t('saveChanges')}</Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>{t('security')}</CardTitle>
              </div>
              <CardDescription>
                {t('securityDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t('sso')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('ssoDesc')}
                </p>
                <Button variant="outline">{t('configureSSO')}</Button>
              </div>
              <div className="grid gap-2">
                <Label>{t('twoFactor')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('twoFactorDesc')}
                </p>
                <Button variant="outline">{t('enable2FA')}</Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
              <CardDescription>
                {t('dangerDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('deleteOrg')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('deleteOrgDesc')}
                  </p>
                </div>
                <Button variant="destructive">{t('delete')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
