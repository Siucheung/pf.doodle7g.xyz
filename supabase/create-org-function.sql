-- 用 SECURITY DEFINER 函数创建组织（绕过 RLS）
-- 在 Supabase SQL Editor 中运行

CREATE OR REPLACE FUNCTION public.create_organization(org_name TEXT, org_slug TEXT, user_id UUID, user_email TEXT DEFAULT '')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- 创建组织
  INSERT INTO public.organizations (name, slug, plan)
  VALUES (org_name, org_slug, 'free')
  RETURNING id INTO new_org_id;

  -- 添加创建者为 owner
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (new_org_id, user_id, 'owner', now());

  -- 创建/更新用户资料
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (user_id, user_email, '')
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(profiles.email, EXCLUDED.email);

  RETURN new_org_id;
END;
$$;

-- 授予已认证用户执行权限
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT, UUID, TEXT) TO authenticated;
