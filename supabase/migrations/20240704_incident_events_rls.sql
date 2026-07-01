-- ============================================================
-- 为 incident_events 表补充 INSERT RLS 策略
-- 允许组织成员为可访问的工单创建事件记录
-- ============================================================

DROP POLICY IF EXISTS "members_create_events" ON public.incident_events;

CREATE POLICY "members_create_events" ON public.incident_events
  FOR INSERT
  WITH CHECK (
    incident_id IN (
      SELECT id FROM public.incidents
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_orgs()
      )
    )
  );
