import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewIncidentClient from './NewIncidentClient'

export default async function NewIncidentPage({
  params,
}: {
  params: { org: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', params.org)
    .single()

  if (!membership) redirect('/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('org_id', params.org)
    .order('name')

  return <NewIncidentClient org={params.org} projects={projects || []} />
}