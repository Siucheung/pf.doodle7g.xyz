-- ============================================================
-- OpsPilot - Row Level Security Policies
-- Run this AFTER schema.sql in Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== Enable RLS on all tables =====
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- ===== Helper Functions =====

-- Get user's orgs with roles
CREATE OR REPLACE FUNCTION public.user_orgs()
RETURNS TABLE (organization_id UUID, role app_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT om.organization_id, om.role
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.accepted_at IS NOT NULL;
$$;

-- Check if user has specific role in org
CREATE OR REPLACE FUNCTION public.has_role(org_id UUID, required_roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_orgs()
    WHERE organization_id = org_id AND role = ANY(required_roles)
  );
$$;

-- ===== Organizations =====
DROP POLICY IF EXISTS "members_read_orgs" ON public.organizations;
CREATE POLICY "members_read_orgs" ON public.organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "authenticated_create_orgs" ON public.organizations;
CREATE POLICY "authenticated_create_orgs" ON public.organizations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "owners_manage_orgs" ON public.organizations;
CREATE POLICY "owners_manage_orgs" ON public.organizations
  FOR ALL USING (has_role(id, ARRAY['owner']::app_role[]));

-- ===== Organization Members =====
DROP POLICY IF EXISTS "members_read_members" ON public.organization_members;
CREATE POLICY "members_read_members" ON public.organization_members
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_members" ON public.organization_members;
CREATE POLICY "admins_manage_members" ON public.organization_members
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Profiles =====
DROP POLICY IF EXISTS "users_read_profiles" ON public.profiles;
CREATE POLICY "users_read_profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (SELECT user_id FROM public.organization_members WHERE accepted_at IS NOT NULL)
  );

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ===== Projects =====
DROP POLICY IF EXISTS "members_read_projects" ON public.projects;
CREATE POLICY "members_read_projects" ON public.projects
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_write_projects" ON public.projects;
CREATE POLICY "admins_write_projects" ON public.projects
  FOR INSERT WITH CHECK (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

DROP POLICY IF EXISTS "admins_update_projects" ON public.projects;
CREATE POLICY "admins_update_projects" ON public.projects
  FOR UPDATE USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

DROP POLICY IF EXISTS "admins_delete_projects" ON public.projects;
CREATE POLICY "admins_delete_projects" ON public.projects
  FOR DELETE USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Deployments =====
DROP POLICY IF EXISTS "members_read_deployments" ON public.deployments;
CREATE POLICY "members_read_deployments" ON public.deployments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "members_create_deployments" ON public.deployments;
CREATE POLICY "members_create_deployments" ON public.deployments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Monitors =====
DROP POLICY IF EXISTS "members_read_monitors" ON public.monitors;
CREATE POLICY "members_read_monitors" ON public.monitors
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "members_manage_monitors" ON public.monitors;
CREATE POLICY "members_manage_monitors" ON public.monitors
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Monitor Checks =====
DROP POLICY IF EXISTS "members_read_checks" ON public.monitor_checks;
CREATE POLICY "members_read_checks" ON public.monitor_checks
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM public.monitors
      WHERE organization_id IN (SELECT organization_id FROM public.user_orgs())
    )
  );

-- ===== Logs =====
DROP POLICY IF EXISTS "members_read_logs" ON public.logs;
CREATE POLICY "members_read_logs" ON public.logs
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

-- ===== Incidents =====
DROP POLICY IF EXISTS "members_read_incidents" ON public.incidents;
CREATE POLICY "members_read_incidents" ON public.incidents
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "members_manage_incidents" ON public.incidents;
CREATE POLICY "members_manage_incidents" ON public.incidents
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Incident Events =====
DROP POLICY IF EXISTS "members_read_events" ON public.incident_events;
CREATE POLICY "members_read_events" ON public.incident_events
  FOR SELECT USING (
    incident_id IN (
      SELECT id FROM public.incidents
      WHERE organization_id IN (SELECT organization_id FROM public.user_orgs())
    )
  );

-- ===== Forge Repos =====
ALTER TABLE public.forge_repos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_forge_repos" ON public.forge_repos;
CREATE POLICY "members_read_forge_repos" ON public.forge_repos
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_forge_repos" ON public.forge_repos;
CREATE POLICY "admins_manage_forge_repos" ON public.forge_repos
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== CI Pipelines =====
ALTER TABLE public.ci_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_ci_pipelines" ON public.ci_pipelines;
CREATE POLICY "members_read_ci_pipelines" ON public.ci_pipelines
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_ci_pipelines" ON public.ci_pipelines;
CREATE POLICY "admins_manage_ci_pipelines" ON public.ci_pipelines
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Webhooks =====
DROP POLICY IF EXISTS "admins_manage_webhooks" ON public.webhooks;
CREATE POLICY "admins_manage_webhooks" ON public.webhooks
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Notification Channels =====
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_notification_channels" ON public.notification_channels;
CREATE POLICY "members_read_notification_channels" ON public.notification_channels
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_notification_channels" ON public.notification_channels;
CREATE POLICY "admins_manage_notification_channels" ON public.notification_channels
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Alertmanager Alerts =====
ALTER TABLE public.alertmanager_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_alertmanager_alerts" ON public.alertmanager_alerts;
CREATE POLICY "members_read_alertmanager_alerts" ON public.alertmanager_alerts
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_alertmanager_alerts" ON public.alertmanager_alerts;
CREATE POLICY "admins_manage_alertmanager_alerts" ON public.alertmanager_alerts
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Audit Log =====
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;
CREATE POLICY "audit_log_select_policy" ON public.audit_log
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
CREATE POLICY "audit_log_insert_policy" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- ===== Infisical 凭据 =====
-- 此表存储加密密钥，仅允许服务端访问。
-- RLS 阻止所有客户端查询；仅通过 SUPABASE_SERVICE_ROLE_KEY 绕过 RLS 访问。
ALTER TABLE public.infisical_credentials ENABLE ROW LEVEL SECURITY;

-- 不开放任何客户端策略：infisical_credentials 仅限服务端。
-- 所有访问通过 API 层使用 SUPABASE_SERVICE_ROLE_KEY 完成，
-- 该密钥完全绕过 RLS，确保安全隔离。
