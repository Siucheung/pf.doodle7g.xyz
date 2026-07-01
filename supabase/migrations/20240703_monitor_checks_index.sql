-- ============================================================
-- Migration: 20240703_monitor_checks_index
-- 为 monitor_checks 表添加时间序列查询索引
-- ============================================================

-- 按监控器 + 时间降序索引（用于最近检查的时间序列图表）
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_time
  ON public.monitor_checks(monitor_id, checked_at DESC);

-- 按监控器 + 状态索引（用于状态分布统计）
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_status
  ON public.monitor_checks(monitor_id, status);

-- 清理过旧的检查记录（保留最近 7 天）
DELETE FROM public.monitor_checks
WHERE checked_at < NOW() - INTERVAL '7 days';
