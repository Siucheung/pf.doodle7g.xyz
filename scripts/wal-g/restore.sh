#!/bin/bash
# ============================================================
# WAL-G 恢复脚本
# 用法：
#   恢复到最新备份:  ./restore.sh
#   恢复到指定时间:   ./restore.sh "2025-01-15 14:30:00 UTC"
# ============================================================
set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

RECOVERY_TARGET_TIME="${1:-}"

: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${WALG_S3_PREFIX:=s3://opspilot-backups/postgres}"
: "${PGDATA:=/var/lib/postgresql/data}"

log "=== WAL-G 恢复准备 ==="
log "目标数据库: ${PGHOST}:${PGPORT}/${PGUSER}"

# 检查 postgres 是否运行，如果运行则提示关闭
if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    log "警告: PostgreSQL 仍在运行！"
    log "请先停止 PostgreSQL 容器再执行恢复"
    log "命令: docker compose stop postgres"
    exit 1
fi

log "列出可用备份:"
wal-g backup-list 2>/dev/null || true

log ""
log "开始从 WAL-G 恢复..."
if [ -n "$RECOVERY_TARGET_TIME" ]; then
    log "恢复目标时间: ${RECOVERY_TARGET_TIME}"

    # 使用远程恢复（流式拉取）
    wal-g backup-fetch "$PGDATA" LATEST --restore-target-time "$RECOVERY_TARGET_TIME"
else
    log "恢复至最新可用备份"
    wal-g backup-fetch "$PGDATA" LATEST
fi

log "恢复完成！"
log ""
log "后续步骤:"
log "1. 启动 postgres 容器: docker compose start postgres"
log "2. 验证数据完整性"
log "3. 如果恢复到指定时间点，确保 recovery.signal 已创建"
echo ""
echo "如需执行 PITR，在 PGDATA 目录中创建 postgresql.auto.conf:"
echo "  restore_command = 'wal-g wal-fetch %f %p'"
echo "  recovery_target_time = '${RECOVERY_TARGET_TIME:-<target-time>}'"
echo "  recovery_target_action = 'promote'"
