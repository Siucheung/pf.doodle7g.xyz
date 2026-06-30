import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import type {Organization} from '@/lib/db-types'

async function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function createDefaultOrgAction() {
  'use server'

  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const emailPrefix = user.email!.split('@')[0]
  const baseSlug = await slugify(emailPrefix)
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

  const {error: rpcError} = await supabase.rpc('create_organization', {
    org_name: `${emailPrefix}'s Workspace`,
    org_slug: uniqueSlug,
    user_id: user.id,
    user_email: user.email,
  })

  if (rpcError) {
    console.error('Error creating default org:', rpcError)
    return {success: false as const, error: rpcError.message || 'Failed to create workspace'}
  }

  redirect(`/${uniqueSlug}`)
}

async function createOrgAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name') as string
  const baseSlug = await slugify(name)

  // Try creating with the base slug first, retry with timestamp suffix on conflict
  const slugsToTry = [baseSlug, `${baseSlug}-${Date.now().toString(36)}`]
  let lastError: {message: string} | null = null

  for (const slug of slugsToTry) {
    const {error: createError} = await supabase.rpc('create_organization', {
      org_name: name,
      org_slug: slug,
      user_id: user.id,
      user_email: user.email || '',
    })

    if (!createError) {
      redirect(`/${slug}`)
    }

    // If it's a duplicate key error, try the next slug
    if (createError.code === '23505' && createError.message.includes('slug')) {
      lastError = createError
      continue
    }

    // Other errors - fail immediately
    console.error('Error creating org:', createError)
    return {success: false as const, error: createError.message || 'Failed to create organization'}
  }

  console.error('Error creating org:', lastError)
  return {success: false as const, error: lastError?.message || 'This organization name is already taken. Please try another.'}
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's first organization
  const {data: memberships} = await (supabase
    .from('organization_members')
    .select('organization:organizations(slug)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .order('created_at', {ascending: true})
    .limit(1)) as { data: { organization: Organization }[] | null }

  if (memberships && memberships.length > 0 && memberships[0].organization?.slug) {
    redirect(`/${memberships[0].organization.slug}`)
  }

  const t = await getTranslations('dashboard')
  const tCommon = await getTranslations('common')

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('welcome')}</h1>
          <p className="mt-2 text-muted-foreground">
            {t('createOrg')}
          </p>
        </div>
        <CreateOrgForm userEmail={user.email!} t={t} tCommon={tCommon} />
      </div>
    </div>
  )
}

function CreateOrgForm({userEmail, t, tCommon}: {userEmail: string; t: ReturnType<typeof getTranslations>; tCommon: ReturnType<typeof getTranslations>}) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <form action={createOrgAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            {t('orgName')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder={t('orgNamePlaceholder')}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            {t('orgDesc')}
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {t('createOrgButton')}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{tCommon('or')}</span>
        </div>
      </div>

      <form action={createDefaultOrgAction}>
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t('skipCreateOrg', {default: 'Skip for now'})}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {t('signedInAs', {email: userEmail})}
      </p>
    </div>
  )
}
