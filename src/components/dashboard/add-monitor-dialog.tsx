'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'

export function AddMonitorDialog({ orgId }: { orgId: string }) {
  const t = useTranslations('monitors')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [expectedStatus, setExpectedStatus] = useState('200')
  const [intervalSeconds, setIntervalSeconds] = useState('60')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (open) {
      fetch(`/api/projects?org_id=${orgId}`)
        .then((r) => r.json())
        .then((data) => setProjects(data.projects || data || []))
        .catch(() => setProjects([]))
    }
  }, [open, orgId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          method,
          expected_status: Number(expectedStatus),
          interval_seconds: Number(intervalSeconds),
          project_id: projectId || null,
          organization_id: orgId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || tCommon('error'))
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setUrl('')
    setMethod('GET')
    setExpectedStatus('200')
    setIntervalSeconds('60')
    setProjectId('')
    setError(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('addMonitor')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('createMonitor')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="m-name">{t('monitorName')} <span className="text-destructive">*</span></Label>
              <Input
                id="m-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('monitorName')}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-url">{t('monitorUrl')} <span className="text-destructive">*</span></Label>
              <Input
                id="m-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/health"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="m-method">{t('monitorMethod')}</Label>
                <Select value={method} onValueChange={(v) => v && setMethod(v)} disabled={loading}>
                  <SelectTrigger id="m-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="HEAD">HEAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-status">{t('expectedStatusCode')} <span className="text-destructive">*</span></Label>
                <Input
                  id="m-status"
                  type="number"
                  value={expectedStatus}
                  onChange={(e) => setExpectedStatus(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-interval">{t('checkInterval')} <span className="text-destructive">*</span></Label>
              <Input
                id="m-interval"
                type="number"
                min={10}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('selectProject')}</Label>
                <Select value={projectId} onValueChange={(v) => v && setProjectId(v)} disabled={loading || projects.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={projects.length === 0 ? t('noProjects') : t('selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
