-- ============================================================
-- OpsPilot - Infisical 集成
-- 存储每个项目加密后的 Infisical Machine Identity 凭据。
--
-- 安全模型：
--   - Client ID 明文存储（非敏感——认证流程必需）
--   - Client Secret 使用 AES-256-GCM 加密存储（敏感信息）
--   - RLS 拒绝所有客户端访问；仅 SUPABASE_SERVICE_ROLE_KEY 可读取
--   - 加密密钥存储在 ENCRYPTION_KEY 环境变量中，永不写入数据库
--
-- 生命周期：
--   - 创建项目时自动创建（通过 API）
--   - 删除项目时随 CASCADE 自动删除
--   - project_id 和 organization_id 均设置了 ON DELETE CASCADE
-- ============================================================

-- ===== Infisical Credentials =====
CREATE TABLE IF NOT EXISTS public.infisical_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  infisical_project_id TEXT NOT NULL,
  infisical_environment TEXT NOT NULL DEFAULT 'prod',
  machine_identity_client_id TEXT NOT NULL,
  machine_identity_client_secret_encrypted TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  infisical_url TEXT NOT NULL DEFAULT 'http://infisical:8080',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, infisical_environment)
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_infisical_credentials_project ON public.infisical_credentials(project_id);
CREATE INDEX IF NOT EXISTS idx_infisical_credentials_org ON public.infisical_credentials(organization_id);

-- ===== Trigger: Auto-update updated_at =====
DROP TRIGGER IF EXISTS set_updated_at ON public.infisical_credentials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.infisical_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
