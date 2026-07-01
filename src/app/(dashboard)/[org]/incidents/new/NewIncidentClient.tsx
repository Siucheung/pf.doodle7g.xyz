'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function NewIncidentClient({
  org,
  projects,
}: {
  org: string
  projects: { id: string; name: string }[]
}) {
  const t = useTranslations('incidents')
  const common = useTranslations('common')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [projectId, setProjectId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          severity,
          project_id: projectId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || common('error'))
      }

      router.push(`/${org}/incidents`)
    } catch (err) {
      setError(err instanceof Error ? err.message : common('error'))
    } finally {
      setLoading(false)
    }
  }

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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  {t('title')} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('description')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('severity')} <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={severity}
                    onValueChange={(v) => v && setSeverity(v)}
                    required
                  >
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
                  <label className="text-sm font-medium">
                    {t('project', { default: 'Project' })} <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={projectId}
                    onValueChange={(v) => v && setProjectId(v)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('project', { default: 'Project' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="py-3 text-sm text-destructive">
                    {error}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Link
                  href={`/${org}/incidents`}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  {common('cancel')}
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
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
