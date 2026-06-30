import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import {DashboardHeader} from '@/components/dashboard/Header'
import {Card, CardContent} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Plus, Users, Crown, Shield, User, Eye} from 'lucide-react'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {formatDistanceToNow} from 'date-fns'
import {ROLE_LABELS} from '@/lib/constants'
import {getTranslations} from 'next-intl/server'
import type {OrganizationMember} from '@/lib/db-types'

async function getTeam(orgId: string) {
  const supabase = await createClient()

  const {data} = await supabase
    .from('organization_members')
    .select('*, profile:profiles(*)')
    .eq('organization_id', orgId)
    .order('role', {ascending: false })
    .order('invited_at', {ascending: true })

  return data || []
}

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const {org} = await params
  const supabase = await createClient()
  const t = await getTranslations('team')

  const {data: orgData} = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', org)
    .single()

  if (!orgData) {
    redirect('/login')
  }

  const team = await getTeam(orgData.id)

  return (
    <>
      <DashboardHeader
        user={{id: '', email: '', full_name: null, avatar_url: null}}
        memberships={[]}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('inviteMember')}
          </Button>
        </div>

        {team.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('noMembers')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('noMembersDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {team.map((member: OrganizationMember) => {
                  const RoleIcon = roleIcons[member.role] || User
                  const initials = (member.profile?.full_name || member.profile?.email || '?')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage
                            src={member.profile?.avatar_url || undefined}
                          />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {member.profile?.full_name || member.profile?.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.profile?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <RoleIcon className="h-3 w-3" />
                          {ROLE_LABELS[member.role] || member.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {member.accepted_at
                            ? `${t('joined', {default: 'Joined'})} ${formatDistanceToNow(new Date(member.accepted_at), {addSuffix: true})}`
                            : t('pending')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
