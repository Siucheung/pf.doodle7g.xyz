'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {toast} from 'sonner'
import {ArrowLeft, Loader2} from 'lucide-react'
import Link from 'next/link'

export default function NewProjectPage({
  params,
}: {
  params: { org: string }
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useTranslations('projects')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || null,
          repositoryUrl: repositoryUrl || null,
          orgSlug: params.org,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create project')
        return
      }

      toast.success(t('projectCreated', {default: 'Project created!'}))

      // If Infisical provisioning failed, surface a warning to admin users
      if (data.warning) {
        toast.warning(data.warning)
      }

      router.push(`/${params.org}/projects/${data.project.slug}`)
    } catch {
      toast.error(t('unexpectedError', {default: 'An unexpected error occurred'}))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${params.org}/projects`}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToProjects')}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('createProject')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('createProjectDesc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('projectName')} *</Label>
          <Input
            id="name"
            placeholder={t('projectNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('description')}</Label>
          <Textarea
            id="description"
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="repositoryUrl">{t('repositoryUrl')}</Label>
          <Input
            id="repositoryUrl"
            type="url"
            placeholder={t('repositoryUrlPlaceholder')}
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('createProject')}
          </Button>
          <Button type="button" variant="outline">
            <Link href={`/${params.org}/projects`}>{t('cancel')}</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
