'use client'

import { useState } from 'react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooter_,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger as AlertDialogTrigger_,
} from '@/components/ui/alert-dialog'
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
import { Pencil, Trash2, Loader2 } from 'lucide-react'

interface MonitorData {
  id: string
  name: string
  url: string
  method: string
  expected_status: number
  interval_seconds: number
  enabled: boolean
  project_id: string | null
}

export function EditMonitorDialog({ monitor }: { monitor: MonitorData }) {
  const t = useTranslations('monitors')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(monitor.name)
  const [url, setUrl] = useState(monitor.url)
  const [method, setMethod] = useState(monitor.method)
  const [expectedStatus, setExpectedStatus] = useState(String(monitor.expected_status))
  const [intervalSeconds, setIntervalSeconds] = useState(String(monitor.interval_seconds))
  const [enabled, setEnabled] = useState(monitor.enabled)

  const resetForm = () => {
    setName(monitor.name)
    setUrl(monitor.url)
    setMethod(monitor.method)
    setExpectedStatus(String(monitor.expected_status))
    setIntervalSeconds(String(monitor.interval_seconds))
    setEnabled(monitor.enabled)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {}
      if (name !== monitor.name) body.name = name
      if (url !== monitor.url) body.url = url
      if (method !== monitor.method) body.method = method
      if (Number(expectedStatus) !== monitor.expected_status) body.expected_status = Number(expectedStatus)
      if (Number(intervalSeconds) !== monitor.interval_seconds) body.interval_seconds = Number(intervalSeconds)
      if (enabled !== monitor.enabled) body.enabled = enabled

      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || tCommon('error'))
      }

      setOpen(false)
      router.push('.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setLoading(false)
    }
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
        <Button variant="outline" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('editMonitor')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="m-name">
                {t('monitorName')} <span className="text-destructive">*</span>
              </Label>
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
              <Label htmlFor="m-url">
                {t('monitorUrl')} <span className="text-destructive">*</span>
              </Label>
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
                <Select
                  value={method}
                  onValueChange={(v) => v && setMethod(v)}
                  disabled={loading}
                >
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
                <Label htmlFor="m-status">
                  {t('expectedStatusCode')} <span className="text-destructive">*</span>
                </Label>
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
              <Label htmlFor="m-interval">
                {t('checkInterval')} <span className="text-destructive">*</span>
              </Label>
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

            <div className="flex items-center gap-2">
              <input
                id="m-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="m-enabled">{t('active')}</Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="flex justify-between items-center">
            <AlertDialog>
              <AlertDialogTrigger_
                render={
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    disabled={loading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('deleteMonitor')}
                  </button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteMonitor')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter_>
                  <AlertDialogCancel disabled={loading}>
                    {tCommon('cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {tCommon('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter_>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {tCommon('save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
