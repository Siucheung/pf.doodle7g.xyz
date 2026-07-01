-- ============================================================
-- OpsPilot - Software Operations Platform
-- Supabase Database Schema
-- 执行顺序（SQL Editor 逐文件执行）：
--   1. schema.sql           ← 本文件：建表/索引/触发器
--   2. migrations/*.sql     ← 新增表定义（按文件名顺序）
--   3. rls-policies.sql     ← 行级安全策略（依赖前两步的表和函数）
-- ============================================================

-- ===== Extensions =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== Custom Types =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
END $$;

-- ===== Organizations (Tenants) =====
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Organization Members =====
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  accepted_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- ===== User Profiles =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Projects =====
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  repository_url TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- ===== Deployments =====
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  environment TEXT NOT NULL DEFAULT 'production',
  commit_sha TEXT,
  commit_message TEXT,
  branch TEXT,
  actor_id UUID REFERENCES auth.users(id),
  duration_ms INTEGER,
  url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Monitors =====
CREATE TABLE IF NOT EXISTS public.monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  expected_status INTEGER DEFAULT 200,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Monitor Checks (Time-series) =====
CREATE TABLE IF NOT EXISTS public.monitor_checks (
  id BIGSERIAL PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  status_code INTEGER,
  response_time_ms INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Logs =====
CREATE TABLE IF NOT EXISTS public.logs (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Incidents =====
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  monitor_id UUID REFERENCES public.monitors(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Incident Events =====
CREATE TABLE IF NOT EXISTS public.incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Webhooks =====
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Forge Repos（代码托管平台仓库映射） =====
-- 将 OpsPilot 项目与 Gitea/Woodpecker 中的仓库关联
CREATE TABLE IF NOT EXISTS public.forge_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  forge_type TEXT NOT NULL DEFAULT 'gitea',
  forge_repo_id TEXT NOT NULL,
  forge_repo_full_name TEXT NOT NULL,
  clone_url TEXT NOT NULL,
  woodpecker_repo_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- ===== CI Pipelines（流水线记录） =====
-- 来自 Woodpecker CI 的流水线执行记录
CREATE TABLE IF NOT EXISTS public.ci_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  event TEXT NOT NULL DEFAULT 'manual',
  commit_sha TEXT,
  commit_message TEXT,
  branch TEXT,
  author TEXT,
  duration_ms INTEGER,
  link_url TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  woodpecker_pipeline_id INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, pipeline_number)
);

-- ===== Notification Channels（通知渠道） =====
-- 存储组织级的通知渠道配置，每个渠道由一个 Apprise URL 定义
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  apprise_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notify_on TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON public.deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_org ON public.deployments(organization_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created ON public.deployments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitors_project ON public.monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_time ON public.monitor_checks(monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_project_time ON public.logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON public.incidents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_forge_repos_project ON public.forge_repos(project_id);
CREATE INDEX IF NOT EXISTS idx_forge_repos_org ON public.forge_repos(organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_pipelines_project ON public.ci_pipelines(project_id);
CREATE INDEX IF NOT EXISTS idx_ci_pipelines_org ON public.ci_pipelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_pipelines_created ON public.ci_pipelines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_channels_org ON public.notification_channels(organization_id);

-- ===== Triggers: Auto-update updated_at =====
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.deployments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.monitors;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monitors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.incidents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.forge_repos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.forge_repos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.ci_pipelines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ci_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.notification_channels;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
