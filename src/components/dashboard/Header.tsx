'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {usePathname} from 'next/navigation'
import Link from 'next/link'
import {Menu, Search, Bell, Building2, User, Settings, LogOut} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Sheet, SheetContent, SheetTrigger} from '@/components/ui/sheet'
import {Badge} from '@/components/ui/badge'
import {AppSidebar} from './Sidebar'

interface DashboardHeaderProps {
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberships: Array<{
    organization_id: string
    organization: { id: string; name: string; slug: string }
    role: string
  }>
}

export function DashboardHeader({ user, memberships }: DashboardHeaderProps) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const t = useTranslations('common')
  const tNav = useTranslations('nav')

  const orgSlug = pathname.split('/')[1] || ''

  // Extract page title from pathname
  const pathSegments = pathname.split('/').filter(Boolean)
  const pageTitle = pathSegments.length >= 2
    ? pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1)
    : tNav('overview')

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger className="lg:hidden">
            <Button variant="ghost" size="icon" nativeButton={false} render={<span />}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <AppSidebar user={user} memberships={memberships} isMobile />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{pageTitle}</h2>
          {pathSegments.length > 2 && (
            <span className="text-muted-foreground">/</span>
          )}
          {pathSegments.length > 2 && (
            <span className="text-sm text-muted-foreground capitalize">
              {pathSegments[2]}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('search')}
              className="w-64 pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon" className="relative" nativeButton={false} render={<span />}>
              <Bell className="h-5 w-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('notifications')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-1">
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{t('notifications')}</p>
                    <p className="text-xs text-muted-foreground">
                      Project &quot;API Service&quot; build failed on main branch
                    </p>
                    <p className="text-xs text-muted-foreground">{t('minutesAgo', {count: 2})}</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">Monitor down</p>
                    <p className="text-xs text-muted-foreground">
                      https://api.example.com health check failed
                    </p>
                    <p className="text-xs text-muted-foreground">{t('minutesAgo', {count: 15})}</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">Incident resolved</p>
                    <p className="text-xs text-muted-foreground">
                      High latency issue has been resolved
                    </p>
                    <p className="text-xs text-muted-foreground">{t('hoursAgo', {count: 1})}</p>
                  </div>
                </DropdownMenuItem>
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" nativeButton={false} render={<span />}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>
                  {(user.full_name || user.email)
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* 用户信息头部 */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>
                  {(user.full_name || user.email)
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name || t('unknown')}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            {/* 组织信息 */}
            {memberships.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1">
                  {memberships.slice(0, 2).map((m) => (
                    <span
                      key={m.organization_id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <Building2 className="h-3 w-3" />
                      {m.organization.name}
                    </span>
                  ))}
                  {memberships.length > 2 && (
                    <span className="text-xs text-muted-foreground">+{memberships.length - 2}</span>
                  )}
                </div>
              </div>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer">
                <Link href="/settings/profile" className="flex w-full items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Link href="/settings" className="flex w-full items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {tNav('settings')}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem className="cursor-pointer">
                <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  {t('signOut')}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
