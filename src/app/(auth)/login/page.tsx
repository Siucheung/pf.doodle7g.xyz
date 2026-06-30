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
      <AuthForm mode="login" />
    </div>
  )
}
