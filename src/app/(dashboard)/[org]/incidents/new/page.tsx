import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// 常用按钮文案（跨命名空间，避免 getTranslations 命名空间限制）
const COMMON_LABELS = {
  cancel: '取消',
  save: '保存',
  delete: '删除',
} as const

export default async function NewIncidentPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const { org } = await params
  const supabase = await createClient()
  const t = await getTranslations('incidents')

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  // 获取组织下的项目列表
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('organization_id', orgData.id)
    .order('name')

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
        <Link
          href={`/${org}/incidents`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToIncidents')}
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t('createIncident')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="POST" action="/api/incidents" className="space-y-4">
              <input type="hidden" name="org" value={org} />

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  {t('title')} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  placeholder={t('title')}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  {t('description')}
                </label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('description')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="severity" className="text-sm font-medium">
                    {t('severity')} <span className="text-destructive">*</span>
                  </label>
                  <Select name="severity" required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('severity')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">{t('critical')}</SelectItem>
                      <SelectItem value="warning">{t('warning')}</SelectItem>
                      <SelectItem value="info">{t('info')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="project_id" className="text-sm font-medium">
                    {t('project', { default: 'Project' })} <span className="text-destructive">*</span>
                  </label>
                  <Select name="project_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('project', { default: 'Project' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {(projects || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Link
                  href={`/${org}/incidents`}
                  className="inline-flex items-center justify-center rounded-lg border border-input bg-background hover:bg-muted text-sm font-medium h-9 px-3 py-2"
                >
                  {COMMON_LABELS.cancel}
                </Link>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createIncident')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
