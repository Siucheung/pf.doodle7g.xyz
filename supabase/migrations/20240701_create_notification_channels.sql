-- 创建通知渠道表
CREATE TABLE public.notification_channels (
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

-- 索引
CREATE INDEX idx_notification_channels_org ON public.notification_channels(organization_id);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.notification_channels;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_notification_channels" ON public.notification_channels;
CREATE POLICY "members_read_notification_channels" ON public.notification_channels
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.user_orgs()));

DROP POLICY IF EXISTS "admins_manage_notification_channels" ON public.notification_channels;
CREATE POLICY "admins_manage_notification_channels" ON public.notification_channels
  FOR ALL USING (has_role(organization_id, ARRAY['owner','admin']::app_role[]));
