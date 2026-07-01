#!/bin/bash
# ============================================================
# WAL-G 备份 Sidecar 入口
# 启动 crond 并按计划执行备份
# ============================================================
set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "WAL-G 备份 Sidecar 启动中..."

# 如果提供了 .env 文件，加载它
if [ -f /scripts/.env ]; then
    set -a
    source /scripts/.env
    set +a
    log "已加载 /scripts/.env 配置"
fi

# 验证配置
: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${WALG_S3_PREFIX:=s3://opspilot-backups/postgres}"

# 导出 WAL-G 所需的环境变量
export WALG_S3_PREFIX

# 等待 PostgreSQL 就绪
log "等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
    if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
        log "PostgreSQL 已就绪"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log "PostgreSQL 未能在 30 秒内就绪，继续启动但备份可能失败"
    fi
    sleep 2
done

# 设置 crontab
BACKUP_CRON="${BACKUP_CRON:-0 2 * * *}"
CLEAN_CRON="${CLEAN_CRON:-0 3 * * *}"

# 写入 cron 任务
cat > /tmp/crontab <<EOF
# 全量备份
${BACKUP_CRON} /scripts/backup.sh >> /var/log/wal-g-backup.log 2>&1
# 清理过期备份
${CLEAN_CRON} wal-g delete before FIND_FULL $(date -d "+${WALG_RETENTION_DAYS:-30} days" +%Y-%m-%d) --confirm >> /var/log/wal-g-clean.log 2>&1
EOF

crontab /tmp/crontab
log "Cron 已配置:"
log "  备份: ${BACKUP_CRON}"
log "  清理: ${CLEAN_CRON}"

# 立即执行首次备份
log "执行首次备份..."
/scripts/backup.sh >> /var/log/wal-g-backup.log 2>&1 || true

# 启动 crond（前台运行）
log "启动 crond..."
crond -f -l 2
