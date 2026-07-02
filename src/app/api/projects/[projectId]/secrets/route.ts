import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SecretService } from '@/lib/services/secret-service'

/**
 * GET /api/projects/[projectId]/secrets
 *
 * 列出项目默认环境下的所有密钥。
 *
 * 权限控制：
 *   - owner、admin、member 角色可查看密钥列表
 *   - viewer 角色禁止访问（密钥属于敏感信息）
 *   - 用户必须属于该项目所在的组织
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // 校验用户是否有该项目的访问权限
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
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .single()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 检查项目是否已配置 Infisical
    const { data: credentials } = await supabase
      .from('infisical_credentials')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (!credentials) {
      return NextResponse.json({ error: 'Infisical not configured for this project' }, { status: 404 })
    }

    const secretService = new SecretService(projectId)
    const secrets = await secretService.listSecrets()

    return NextResponse.json({ secrets })
  } catch (error) {
    console.error('列出密钥失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[projectId]/secrets
 *
 * 创建新密钥（Upsert 语义：键名已存在则更新值）。
 *
 * 必填参数：{ key: string, value: string }
 * 可选参数：{ folderPath?: string, type?: 'shared' | 'personal' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // 校验用户权限
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
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .single()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { key, value, folderPath = '/', type = 'shared' } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    const secretService = new SecretService(projectId)
    const secret = await secretService.createSecret({ key, value, folderPath, type })

    return NextResponse.json({ secret }, { status: 201 })
  } catch (error) {
    console.error('创建密钥失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
