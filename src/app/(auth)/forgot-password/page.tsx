'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {toast} from 'sonner'
import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const t = useTranslations('auth')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
    toast.success(t('resetLinkSent', {email}))
  }

  return (
    <div className="w-full max-w-md">
      <Link href="/login" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('signIn')}
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('forgotPassword')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('appName')}
        </p>
      </div>

      {sent ? (
        <p className="text-center text-muted-foreground">
          {t('resetLinkSent', {email})}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : t('sendResetLink', {default: 'Send reset link'})}
          </Button>
        </form>
      )}
    </div>
  )
}
