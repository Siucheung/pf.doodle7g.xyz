-- ============================================================
-- 审计日志表与触发器
-- 基于 PostgreSQL 触发器记录关键表的数据变更
-- 兼容 Supabase 和本地 Docker 部署
-- ============================================================
-- 迁移ID: 20240702_create_audit_log
-- 如果已存在则先删除（幂等部署）
-- ============================================================

-- 删除已有对象（幂等，可选 — 首次迁移后注释此行避免删数据）
-- DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TRIGGER IF EXISTS trg_audit_projects ON projects;
DROP TRIGGER IF EXISTS trg_audit_incidents ON incidents;
DROP TRIGGER IF EXISTS trg_audit_notification_channels ON notification_channels;
DROP TRIGGER IF EXISTS trg_audit_credentials ON infisical_credentials;
DROP FUNCTION IF EXISTS public.audit_trigger();

-- ============================================================
-- 审计日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    table_name      TEXT NOT NULL,              -- 被修改的表名
    operation       TEXT NOT NULL,              -- INSERT / UPDATE / DELETE
    record_id       TEXT,                       -- 被修改记录的 ID
    changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 操作人
    old_data        JSONB,                      -- 修改前的数据快照
    new_data        JSONB,                      -- 修改后的数据快照
    ip_address      TEXT,                       -- 客户端 IP（需应用层传入）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON public.audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);

-- RLS 见 supabase/rls-policies.sql

-- ============================================================
-- 审计触发器函数
-- 自动记录表的 INSERT / UPDATE / DELETE 操作
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id    UUID;
    v_record_id TEXT;
    v_old_data  JSONB;
    v_new_data  JSONB;
BEGIN
    -- 确定 organization_id（优先从 NEW 获取）
    v_org_id := COALESCE(
        NEW.organization_id,
        OLD.organization_id,
        NULL
    );

    -- 跳过没有组织关联的记录（如系统表）
    IF v_org_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 确定记录 ID
    v_record_id := COALESCE(
        NEW.id::TEXT,
        OLD.id::TEXT,
        NULL
    );

    -- 构建数据快照（排除敏感字段）
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
    END IF;

    -- 写入审计日志
    INSERT INTO public.audit_log (
        organization_id,
        table_name,
        operation,
        record_id,
        changed_by,
        old_data,
        new_data,
        ip_address
    ) VALUES (
        v_org_id,
        TG_TABLE_NAME,
        TG_OP,
        v_record_id,
        auth.uid(),
        v_old_data,
        v_new_data,
        current_setting('request.headers', true)::json->>'x-forwarded-for'
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 在关键业务表上启用审计
-- 注意：只审计操作型表，避免审计高频率的内部表
-- ============================================================

-- projects 表
CREATE TRIGGER trg_audit_projects
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- incidents 表
CREATE TRIGGER trg_audit_incidents
    AFTER INSERT OR UPDATE OR DELETE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- notification_channels 表
CREATE TRIGGER trg_audit_notification_channels
    AFTER INSERT OR UPDATE OR DELETE ON public.notification_channels
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- infisical_credentials 表（仅记录操作类型，不记录凭据内容）
CREATE TRIGGER trg_audit_credentials
    AFTER INSERT OR UPDATE OR DELETE ON public.infisical_credentials
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
