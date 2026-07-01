import {getTranslations} from 'next-intl/server'
import {AuthForm} from '@/components/auth/AuthForm'

export default async function LoginPage() {
  const t = await getTranslations('auth')

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t('welcomeBack')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('appName')}
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-center">
        <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mb-1.5">
          Demo
        </span>
        <p className="text-muted-foreground text-xs">
          演示账号已预填，点击登录即可
        </p>
      </div>

      <AuthForm mode="login" />
    </div>
  )
}
