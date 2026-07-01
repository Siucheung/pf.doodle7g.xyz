'use client'

import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  Rocket,
  Activity,
  ScrollText,
  AlertTriangle,
  BellRing,
  Bell,
  Shield,
  Users,
  Settings,
  ChevronRight,
  Building2,
  LogOut,
  Crown,
  User,
  FileText,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import {SIDEBAR_ITEMS} from '@/lib/constants'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
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
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  FolderOpen,
  Rocket,
  Activity,
  ScrollText,
  AlertTriangle,
  BellRing,
  Bell,
  Shield,
  Users,
  Settings,
  FileText,
}

export function AppSidebar({
  user,
  memberships,
  isMobile = false,
}: {
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberships: Array<{
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    role: string
  }>
  isMobile?: boolean
}) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <TooltipProvider delay={0}>
      {isMobile ? (
        <MobileSidebar user={user} memberships={memberships} pathname={pathname} t={t} />
      ) : (
        <DesktopSidebar user={user} memberships={memberships} pathname={pathname} t={t} />
      )}
    </TooltipProvider>
  )
}

function DesktopSidebar({
  user,
  memberships,
  pathname,
  t,
}: {
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberships: Array<{
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    role: string
  }>
  pathname: string
  t: (key: string) => string
}) {
  // Extract org slug from pathname
  const orgSlug = pathname.split('/')[1] || ''
  const currentOrg = memberships.find((m) => m.organization.slug === orgSlug)

  // Get highest role for current org
  const currentOrgRole = currentOrg?.role || 'viewer'

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
          <Activity className="h-6 w-6 text-primary" />
          <span>OpsPilot</span>
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-2">
          {SIDEBAR_ITEMS.map((item) => {
            const isExternal = 'external' in item && (item as any).external
            const href = isExternal ? item.href : `/${orgSlug}${item.href ? `/${item.href}` : ''}`
            const Icon = iconMap[item.icon] || LayoutDashboard
            // Match based on the page segment (after org slug)
            const pageSegment = pathname.split('/').filter(Boolean)[1] || ''
            const isActive = !isExternal && (item.href === '' ? pageSegment === '' : pageSegment === item.href)

            if (isExternal) {
              return (
                <a
                  key={item.titleKey}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.titleKey)}
                </a>
              )
            }

            return (
              <Link
                key={item.titleKey}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.titleKey)}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Org Switcher & User Menu */}
      <div className="border-t p-2 space-y-2">
        <OrgSwitcher memberships={memberships} currentOrg={currentOrg} t={t} />

        <UserMenu user={user} memberships={memberships} />
      </div>
    </aside>
  )
}

function MobileSidebar({
  user,
  memberships,
  pathname,
  t,
}: {
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberships: Array<{
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    role: string
  }>
  pathname: string
  t: (key: string) => string
}) {
  const orgSlug = pathname.split('/')[1] || ''
  const currentOrg = memberships.find((m) => m.organization.slug === orgSlug)
  const currentOrgRole = currentOrg?.role || 'viewer'

  return (
    <SheetContent side="left" className="w-60 p-0">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
          <Activity className="h-6 w-6 text-primary" />
          <span>OpsPilot</span>
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-2">
          {SIDEBAR_ITEMS.map((item) => {
            const isExternal = 'external' in item && (item as any).external
            const href = isExternal ? item.href : `/${orgSlug}${item.href ? `/${item.href}` : ''}`
            const Icon = iconMap[item.icon] || LayoutDashboard
            // Match based on the page segment (after org slug)
            const pageSegment = pathname.split('/').filter(Boolean)[1] || ''
            const isActive = !isExternal && (item.href === '' ? pageSegment === '' : pageSegment === item.href)

            if (isExternal) {
              return (
                <a
                  key={item.titleKey}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.titleKey)}
                </a>
              )
            }

            return (
              <Link
                key={item.titleKey}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.titleKey)}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <UserMenu user={user} memberships={memberships} />
      </div>
    </SheetContent>
  )
}

function OrgSwitcher({
  memberships,
  currentOrg,
  t,
}: {
  memberships: Array<{
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    role: string
  }>
  currentOrg?: { organization: { id: string; name: string; slug: string } }
  t: (key: string) => string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" className="w-full justify-start gap-2 px-3" nativeButton={false} render={<span />}>
          <Building2 className="h-4 w-4" />
          <span className="truncate text-sm">
            {currentOrg?.organization?.name || t('selectOrg')}
          </span>
          <ChevronRight className="ml-auto h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('organizations')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {memberships.map((membership) => (
          <DropdownMenuItem key={membership.organization_id}>
            <Link
              href={`/${membership.organization.slug}/projects`}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              <span className="flex-1 truncate">{membership.organization.name}</span>
              {membership.role === 'owner' && <Crown className="h-3 w-3 text-yellow-500" />}
              {membership.role === 'admin' && <Crown className="h-3 w-3 text-blue-500" />}
            </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({
  user,
  memberships,
}: {
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberships: Array<{
    organization_id: string
    organization: {
      id: string
      name: string
      slug: string
    }
    role: string
  }>
}) {
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const initials = (user.full_name || user.email)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const topRole = memberships.reduce<string>((prev, m) => {
    const rank = { owner: 3, admin: 2, member: 1, viewer: 0 }
    return (rank[m.role as keyof typeof rank] || 0) > (rank[prev as keyof typeof rank] || 0)
      ? m.role
      : prev
  }, 'viewer')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full">
        <Button variant="ghost" className="w-full justify-start gap-3 px-3" nativeButton={false} render={<span />}>
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start leading-tight min-w-0">
            <span className="truncate text-sm font-medium">{user.full_name || tCommon('unknown')}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* 用户信息头部 */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium truncate">{user.full_name || tCommon('unknown')}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        {/* 角色与组织信息 */}
        {memberships.length > 0 && (
          <>
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1">
                {memberships.slice(0, 2).map((m) => (
                  <span
                    key={m.organization_id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Building2 className="h-3 w-3" />
                    {m.organization.name}
                    {m.role === 'owner' && <Crown className="h-3 w-3 text-yellow-500" />}
                  </span>
                ))}
                {memberships.length > 2 && (
                  <span className="text-xs text-muted-foreground">+{memberships.length - 2}</span>
                )}
              </div>
            </div>
          </>
        )}

        <DropdownMenuSeparator />

        {/* 操作菜单 */}
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer">
            <Link href="/settings/profile" className="flex w-full items-center gap-2">
              <User className="h-4 w-4" />
              {tCommon('profile')}
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
              {tAuth('signOut')}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
