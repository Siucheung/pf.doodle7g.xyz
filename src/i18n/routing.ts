import {createNavigation} from 'next-intl/navigation'

export const locales = ['zh-CN', 'en'] as const
export const defaultLocale = 'zh-CN' as const

export const routing = {
  locales,
  defaultLocale,
  localePrefix: 'as-needed' as const,
}

export const {Link, redirect, usePathname, useRouter} =
  createNavigation(routing)
