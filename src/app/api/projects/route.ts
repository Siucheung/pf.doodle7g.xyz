import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'

/**
 * POST /api/projects
 *
 * 创建新项目，同时在 Supabase 和 Infisical 中完成资源分配。
 *
 * 两阶段创建：
 *   1. 在 Supabase 中创建项目记录（只要参数合法，此步骤不会失败）
 *   2. 在 Infisical 中分配资源（项目 + 环境 + Machine Identity）
 *
 * 如果阶段 2 失败，项目仍然创建成功，但响应中会包含 warning 字段，
 * 前端可据此提示用户密钥管理功能暂不可用。
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, repositoryUrl, orgSlug } = body

    if (!name || !orgSlug) {
      return NextResponse.json({ error: 'Name and orgSlug are required' }, { status: 400 })
    }

    // 解析组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // 权限校验：仅 owner 或 admin 可创建项目
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 根据项目名生成 URL 安全的 slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '')

    // 在 Supabase 中创建项目
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        organization_id: org.id,
        name,
        slug,
        description: description || null,
        repository_url: repositoryUrl || null,
      })
      .select()
      .single()

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 400 })
    }

    // 如果配置了 Infisical，自动分配 Infisical 资源
    const infisicalUrl = process.env.INFISICAL_URL || 'http://infisical:8080'
    const infisicalOrgId = process.env.INFISICAL_ORG_ID
    let infisicalWarning: string | null = null

    if (infisicalOrgId) {
      try {
        // 步骤 1：在 Infisical 中创建项目
        const projectResponse = await fetch(
          `${infisicalUrl}/api/v1/projects`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.INFISICAL_SERVICE_TOKEN}`,
            },
            body: JSON.stringify({
              name: `${project.name} - ${project.slug}`,
              slug: project.slug,
            }),
          }
        )

        if (!projectResponse.ok) {
          throw new Error(`创建 Infisical 项目失败: ${await projectResponse.text()}`)
        }

        const projectData = await projectResponse.json()
        const infisicalProjectId = projectData.project.id

        // 步骤 2：创建三套环境（prod、staging、preview）
        const environments = ['prod', 'staging', 'preview']
        for (const env of environments) {
          await fetch(
            `${infisicalUrl}/api/v1/projects/${infisicalProjectId}/environments`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.INFISICAL_SERVICE_TOKEN}`,
              },
              body: JSON.stringify({ name: env, slug: env }),
            }
          )
          // 如果环境已存在，Infisical 会返回非 2xx 状态码。
          // 此处有意忽略单个环境创建失败，保证幂等性。
        }

        // 步骤 3：为此项目创建 Machine Identity
        // 该身份用于 OpsPilot 服务端访问该项目的密钥
        const identityResponse = await fetch(
          `${infisicalUrl}/api/v1/projects/${infisicalProjectId}/machine-identities`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.INFISICAL_SERVICE_TOKEN}`,
            },
            body: JSON.stringify({
              name: `ops-pilot-${project.slug}`,
              type: 'universal-auth',
            }),
          }
        )

        if (!identityResponse.ok) {
          throw new Error(`创建 Machine Identity 失败: ${await identityResponse.text()}`)
        }

        const identityData = await identityResponse.json()
        const clientId = identityData.machineIdentity.clientId
        const clientSecret = identityData.machineIdentity.clientSecret

        // 步骤 4：将凭据加密后存入 Supabase
        // Client Secret 使用 AES-256-GCM 静态加密
        const encryptedSecret = encrypt(clientSecret)

        await supabase.from('infisical_credentials').insert({
          project_id: project.id,
          organization_id: org.id,
          infisical_project_id: infisicalProjectId,
          infisical_environment: 'prod',
          machine_identity_client_id: clientId,
          machine_identity_client_secret_encrypted: encryptedSecret,
          encryption_key_id: 'default',
          infisical_url: infisicalUrl,
        })
      } catch (infisicalError) {
        // 记录完整错误用于排查，但向前端返回友好提示
        console.error('Infisical 资源分配失败:', infisicalError)
        infisicalWarning =
          '项目已创建，但 Infisical 密钥管理未能自动配置。' +
          '密钥功能在该问题解决前暂不可用。'
      }
    }

    return NextResponse.json(
      { project, warning: infisicalWarning },
      { status: 201 }
    )
  } catch (error) {
    console.error('创建项目失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
