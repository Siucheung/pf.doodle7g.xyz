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
CREATE POLICY "members_read_orgs" ON public.organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "authenticated_create_orgs" ON public.organizations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "owners_manage_orgs" ON public.organizations
  FOR ALL USING (has_role(id, ARRAY['owner']::app_role[]));

-- ===== Organization Members =====
CREATE POLICY "members_read_members" ON public.organization_members
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "admins_manage_members" ON public.organization_members
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Profiles =====
CREATE POLICY "users_read_profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (SELECT user_id FROM public.organization_members WHERE accepted_at IS NOT NULL)
  );

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ===== Projects =====
CREATE POLICY "members_read_projects" ON public.projects
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "admins_write_projects" ON public.projects
  FOR INSERT WITH CHECK (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

CREATE POLICY "admins_update_projects" ON public.projects
  FOR UPDATE USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

CREATE POLICY "admins_delete_projects" ON public.projects
  FOR DELETE USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));

-- ===== Deployments =====
CREATE POLICY "members_read_deployments" ON public.deployments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "members_create_deployments" ON public.deployments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Monitors =====
CREATE POLICY "members_read_monitors" ON public.monitors
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "members_manage_monitors" ON public.monitors
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Monitor Checks =====
CREATE POLICY "members_read_checks" ON public.monitor_checks
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM public.monitors
      WHERE organization_id IN (SELECT organization_id FROM public.user_orgs())
    )
  );

-- ===== Logs =====
CREATE POLICY "members_read_logs" ON public.logs
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

-- ===== Incidents =====
CREATE POLICY "members_read_incidents" ON public.incidents
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

CREATE POLICY "members_manage_incidents" ON public.incidents
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.user_orgs() WHERE role IN ('owner','admin','member')
    )
  );

-- ===== Incident Events =====
CREATE POLICY "members_read_events" ON public.incident_events
  FOR SELECT USING (
    incident_id IN (
      SELECT id FROM public.incidents
      WHERE organization_id IN (SELECT organization_id FROM public.user_orgs())
    )
  );

-- ===== Webhooks =====
CREATE POLICY "admins_manage_webhooks" ON public.webhooks
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));
