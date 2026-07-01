#!/bin/bash
# ============================================================
# WAL-G 备份脚本
# 使用远程备份模式（BASE_BACKUP 协议）连接 PostgreSQL
# ============================================================
set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 验证必需的环境变量
: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${WALG_S3_PREFIX:=s3://opspilot-backups/postgres}"

log "开始执行 WAL-G 备份..."
log "目标数据库: ${PGHOST}:${PGPORT}/${PGUSER}"

# 检查 PostgreSQL 连接
if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    log "错误: PostgreSQL 无法连接"
    exit 1
fi

log "PostgreSQL 连接正常"

# 执行全量备份（远程模式：不指定数据目录，使用 BASE_BACKUP 协议）
if wal-g backup-push; then
    log "备份成功完成"
else
    log "备份失败"
    exit 1
fi

# 列出最近的备份
log "最近的备份列表:"
wal-g backup-list 2>/dev/null | tail -5 || true
