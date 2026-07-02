'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Bell, Plus, Trash2, Send, Loader2, PlugZap, Info } from 'lucide-react'
import { NOTIFICATION_CHANNEL_TYPES, NOTIFICATION_EVENTS } from '@/lib/constants'
import type { NotificationChannel } from '@/lib/db-types'

export default function NotificationsPage() {
  const t = useTranslations('notifications')
  const tNav = useTranslations('nav')
  const params = useParams()
  const orgSlug = params.org as string

  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('slack')
  const [formUrl, setFormUrl] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [formNotifyOn, setFormNotifyOn] = useState<string[]>([])

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // 让中间的 DashboardHeader 处理认证
        return
      }
      const res = await fetch(`/api/notification-channels?org=${orgSlug}`)
      if (!res.ok) {
        throw new Error(t('fetchError'))
      }
      const data = await res.json()
      setChannels(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchError'))
    } finally {
      setLoading(false)
    }
  }, [orgSlug, t])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchChannels() }, [fetchChannels])

  const openCreateDialog = () => {
    setEditingChannel(null)
    setFormName('')
    setFormType('slack')
    setFormUrl('')
    setFormEnabled(true)
    setFormNotifyOn([])
    setTestResult(null)
    setDialogOpen(true)
  }

  const openEditDialog = (channel: NotificationChannel) => {
    setEditingChannel(channel)
    setFormName(channel.name)
    setFormType(channel.type)
    setFormUrl(channel.apprise_url)
    setFormEnabled(channel.enabled)
    setFormNotifyOn(channel.notify_on || [])
    setTestResult(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formUrl) return

    setSaving(true)
    try {
      const body = {
        name: formName,
        type: formType,
        apprise_url: formUrl,
        enabled: formEnabled,
        notify_on: formNotifyOn,
        orgSlug,
      }

      let res: Response
      if (editingChannel) {
        res = await fetch(`/api/notification-channels/${editingChannel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/notification-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t('saveSuccess'))
      }

      setDialogOpen(false)
      await fetchChannels()
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : t('testFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!formUrl || editingChannel?.id) return

    setTesting(true)
    setTestResult(null)
    try {
      // 先保存再测试
      const saveRes = await fetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          type: formType,
          apprise_url: formUrl,
          enabled: formEnabled,
          notify_on: formNotifyOn,
          orgSlug,
        }),
      })

      const saved = await saveRes.json()
      if (!saveRes.ok) {
        throw new Error(saved.error || t('saveFailed'))
      }

      const testRes = await fetch(`/api/notification-channels/${saved.id}/test`, {
        method: 'POST',
      })

      const testData = await testRes.json()

      // 测试完成后删除临时渠道
      await fetch(`/api/notification-channels/${saved.id}`, {
        method: 'DELETE',
      })

      if (!testRes.ok) {
        throw new Error(testData.error || t('testFailed'))
      }

      setTestResult('success')
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : t('testFailed'))
    } finally {
      setTesting(false)
    }
  }

  const handleTestExisting = async (id: string) => {
    setTesting(true)
    try {
      const res = await fetch(`/api/notification-channels/${id}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t('testFailed'))
      }
      // 显示 toast 或类似提示
      alert(t('testSuccess'))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('testFailed'))
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notification-channels/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(t('deleteFailed'))
      }
      await fetchChannels()
    } catch (err) {
      console.error('[Notifications] 删除失败:', err)
    }
  }

  const toggleEvent = (event: string) => {
    setFormNotifyOn((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    )
  }

  const getEventLabel = (event: string) => {
    const key = 'events.' + event.replace('.', '_')
    return t(key) || event
  }

  return (
    <>
      <DashboardHeader
        user={{ id: '', email: '', full_name: null, avatar_url: null }}
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button nativeButton={false} render={<span />}>
                <Plus className="mr-2 h-4 w-4" />
                {t('addChannel')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingChannel ? t('editChannel') : t('addChannel')}
                </DialogTitle>
                <DialogDescription>
                  {t('description')}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* 渠道名称 */}
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('channelName')}</Label>
                  <Input
                    id="name"
                    placeholder={t('channelNamePlaceholder')}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                {/* 渠道类型 */}
                <div className="grid gap-2">
                  <Label htmlFor="type">{t('channelType')}</Label>
                  <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder={t('channelType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NOTIFICATION_CHANNEL_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Apprise URL */}
                <div className="grid gap-2">
                  <Label htmlFor="url">{t('appriseUrl')}</Label>
                  <Input
                    id="url"
                    placeholder={t('appriseUrlPlaceholder')}
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('appriseUrlHelp')}
                  </p>
                </div>

                {/* 启用开关 */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enabled"
                    checked={formEnabled}
                    onCheckedChange={(checked) => setFormEnabled(!!checked)}
                  />
                  <Label htmlFor="enabled">{t('enabled')}</Label>
                </div>

                {/* 通知事件 */}
                <div className="grid gap-2">
                  <Label>{t('notifyOn')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {NOTIFICATION_EVENTS.map((event) => (
                      <Badge
                        key={event}
                        variant={formNotifyOn.includes(event) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleEvent(event)}
                      >
                        {getEventLabel(event)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 测试结果 */}
                {testResult && (
                  <div
                    className={`p-3 rounded-md text-sm ${
                      testResult === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {testResult === 'success' ? t('testSuccess') : testResult}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {!editingChannel && (
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing || !formName || !formUrl}
                  >
                    {testing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {t('test')}
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving || !formName || !formUrl}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t('testAndSave')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* 渠道列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-destructive">{error}</p>
<Button variant="outline" className="mt-4" onClick={fetchChannels}>
                 {t('retry')}
               </Button>
            </CardContent>
          </Card>
        ) : channels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('noChannels')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('noChannelsDesc')}
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t('addChannel')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => (
              <Card key={channel.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <PlugZap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {channel.name}
                        </CardTitle>
                        <CardDescription>
                          {NOTIFICATION_CHANNEL_TYPES[channel.type] || channel.type}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!channel.enabled && (
                        <Badge variant="secondary" className="text-xs">{t('disabled')}</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestExisting(channel.id)}
                        disabled={testing}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {t('test')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(channel)}
                       >
                         {t('edit')}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger>
                          <Button variant="ghost" size="sm" className="text-destructive" nativeButton={false} render={<span />}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('deleteConfirm', { name: channel.name })}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('undoWarning')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(channel.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                               {t('delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                {channel.notify_on && channel.notify_on.length > 0 && (
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {channel.notify_on.map((event) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {getEventLabel(event)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
