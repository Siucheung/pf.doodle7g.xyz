import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Next.js 16: cookies can only be modified in Server Actions or
          // Route Handlers. During server component rendering, setAll is
          // called for internal session refresh but values rarely change.
          // Silently catch to avoid crashing page renders.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookie modification during render is not allowed — safe to ignore.
            // Session tokens are refreshed via middleware.ts.
          }
        },
      },
    }
  )
}
