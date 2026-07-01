import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/orgs/[slug]
 *
 * 删除组织及其所有关联数据（CASCADE）。
 * 仅组织 owner 可执行此操作。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 查询组织
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (!org) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 })
    }

    // 校验权限：仅 owner 可删除
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: '仅组织所有者可执行删除操作' }, { status: 403 })
    }

    // 执行删除（所有关联表通过 ON DELETE CASCADE 自动清理）
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '删除组织失败' },
      { status: 500 }
    )
  }
}
