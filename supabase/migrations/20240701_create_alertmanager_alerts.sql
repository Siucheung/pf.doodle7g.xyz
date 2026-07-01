-- Alertmanager 告警集成
-- 存储从 Alertmanager 接收到的告警记录，关联到 incidents 工单

CREATE TABLE IF NOT EXISTS public.alertmanager_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'firing',
  labels JSONB NOT NULL DEFAULT '{}',
  annotations JSONB NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  generator_url TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_alertmanager_alerts_org ON public.alertmanager_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alertmanager_alerts_fingerprint
  ON public.alertmanager_alerts(organization_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_alertmanager_alerts_status
  ON public.alertmanager_alerts(organization_id, status);

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.alertmanager_alerts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.alertmanager_alerts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS 见 supabase/rls-policies.sql
