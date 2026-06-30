import {routing} from '@/i18n/routing'
import {updateSession} from '@/lib/supabase/middleware'
import {type NextRequest, NextResponse} from 'next/server'

export async function middleware(request: NextRequest) {
  const {session, supabaseResponse} = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Strip locale prefix for auth checks
  const locale = routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  const pathWithoutLocale = locale ? pathname.slice(`/${locale}`.length) : pathname

  const protectedPaths = ['/dashboard', '/projects', '/deployments', '/monitors', '/logs', '/incidents', '/team', '/settings']
  const isProtectedRoute = protectedPaths.some(path =>
    pathWithoutLocale === path || pathWithoutLocale.startsWith(path + '/')
  )

  const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isAuthRoute = authPaths.some(path => pathWithoutLocale === path || pathWithoutLocale.startsWith(path + '/'))

  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
