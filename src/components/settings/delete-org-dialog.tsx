'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteOrgDialogProps {
  orgSlug: string
  orgName: string
}

export function DeleteOrgDialog({ orgSlug, orgName }: DeleteOrgDialogProps) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const canDelete = confirmText === orgName

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/orgs/${orgSlug}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '删除失败')
      }

      toast.success(t('deleteSuccess'))
      // 删除成功，跳转到仪表盘
      router.push('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {t('delete')}
          </button>
        }
      />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('deleteOrgConfirm')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteOrgConfirmDesc', { name: orgName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-4 pb-2">
          <p className="text-sm text-muted-foreground mb-2">
            {t('deleteOrgTypeConfirm', { name: orgName })}
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={orgName}
            className="font-mono text-sm"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete || deleting}
            onClick={handleDelete}
            variant="destructive"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deleting ? t('deleting') : t('confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
