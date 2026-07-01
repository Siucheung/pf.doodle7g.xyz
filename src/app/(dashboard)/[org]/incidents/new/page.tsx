import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewIncidentClient from './NewIncidentClient'

export default async function NewIncidentPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const { org } = await params
  const supabase = await createClient()

  // 验证 org slug 有效（其它页面同模式）
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('organization_id', orgData.id)
    .order('name')

  return <NewIncidentClient org={org} projects={projects || []} />
}