import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SecretService } from '@/lib/services/secret-service'

/**
 * GET /api/projects/[projectId]/secrets/[key]
 *
 * 从 Infisical 获取单个密钥。
 * 返回密钥的实际值——前端需谨慎处理，避免泄露。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; key: string }> }
) {
  try {
    const { projectId, key } = await params
    const supabase = await createClient()

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .maybeSingle()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const secretService = new SecretService(projectId)
    const secret = await secretService.getSecret(key)

    if (!secret) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 })
    }

    return NextResponse.json({ secret })
  } catch (error) {
    console.error('获取密钥失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/projects/[projectId]/secrets/[key]
 *
 * 更新指定密钥的值。
 * 必填参数：{ value: string }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string; key: string }> }
) {
  try {
    const { projectId, key } = await params
    const supabase = await createClient()

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .maybeSingle()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { value } = body

    if (value === undefined) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }

    const secretService = new SecretService(projectId)
    const secret = await secretService.updateSecret(key, value)

    return NextResponse.json({ secret })
  } catch (error) {
    console.error('更新密钥失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[projectId]/secrets/[key]
 *
 * 删除指定密钥。
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; key: string }> }
) {
  try {
    const { projectId, key } = await params
    const supabase = await createClient()

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .maybeSingle()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const secretService = new SecretService(projectId)
    await secretService.deleteSecret(key)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除密钥失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
