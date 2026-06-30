'use client'

import {useTranslations} from 'next-intl'
import {useState, useEffect} from 'react'
import {createClient} from '@/lib/supabase/client'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {toast} from 'sonner'
import {useRouter} from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useTranslations('auth')

  useEffect(() => {
    const checkSession = async () => {
      const {data: {user}} = await supabase.auth.getUser()
      if (!user) {
        toast.error(t('invalidResetLink', {default: 'Invalid or expired reset link'}))
        router.push('/login')
      }
    }
    checkSession()
  }, [supabase.auth, router, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch', {default: 'Passwords do not match'}))
      return
    }

    setLoading(true)

    const {error} = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(t('passwordUpdated', {default: 'Password updated successfully'}))
    router.push('/login')
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('resetPassword', {default: 'Reset password'})}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('enterNewPassword', {default: 'Enter your new password below'})}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t('newPassword', {default: 'New password'})}</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '...' : t('updatePassword', {default: 'Update password'})}
        </Button>
      </form>
    </div>
  )
}
