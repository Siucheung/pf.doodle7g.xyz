'use client'

import {useTranslations} from 'next-intl'
import {useState, useEffect} from 'react'
import {createClient} from '@/lib/supabase/client'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Separator} from '@/components/ui/separator'
import {toast} from 'sonner'
import {User, Loader2} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'

type Mode = 'login' | 'signup'

interface AuthFormProps {
  mode?: Mode
}

export function AuthForm({mode = 'login'}: AuthFormProps) {
  const supabase = createClient()
  const router = useRouter()
  const t = useTranslations('auth')

  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [email, setEmail] = useState('seancheung.letter@qq.com')
  const [password, setPassword] = useState('RZnAO%7hz&a3v6')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  useEffect(() => {
    const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const {error} = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success(t('welcomeBack'))
      } else {
        const {error} = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success(t('checkEmail'))
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async () => {
    setOauthLoading(true)
    const {error} = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setOauthLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('fullName')}</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={!isLogin}
            />
          </div>
        )}

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

        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLogin ? t('signIn') : t('signUp')}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleOAuth}
        disabled={oauthLoading}
      >
        {oauthLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <User className="mr-2 h-4 w-4" />
        )}
        GitHub
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? t('noAccount') : t('hasAccount')}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="font-medium text-primary underline-offset-4 hover:underline ml-1"
        >
          {isLogin ? t('signUp') : t('signIn')}
        </button>
      </p>

      {isLogin && (
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </p>
      )}
    </div>
  )
}
