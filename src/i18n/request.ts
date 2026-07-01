import {notFound} from 'next/navigation'
import {getRequestConfig} from 'next-intl/server'
import {locales, defaultLocale} from '@/i18n/routing'

export default getRequestConfig(async ({requestLocale}: {requestLocale: Promise<string | undefined>}) => {
  const locale = (await requestLocale) ?? defaultLocale

  if (!(locales as readonly string[]).includes(locale)) {
    notFound()
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
