#!/bin/bash
# Gitea 和 Woodpecker CI 共享 PostgreSQL 初始化脚本
# 此脚本在 PostgreSQL 容器首次初始化时自动执行
# 如需重建：docker compose down -v && docker compose up -d

set -e

# 密码可通过环境变量覆盖（默认仅供本地开发）
GITEA_PASSWORD="${GITEA_DB_PASSWORD:-gitea}"
WOODPECKER_PASSWORD="${WOODPECKER_DB_PASSWORD:-woodpecker}"

# 利用 psql 连接到默认的 postgres 数据库执行
psql -U "$POSTGRES_USER" -d postgres <<-EOSQL
    -- 创建数据库
    SELECT 'CREATE DATABASE gitea'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gitea')\gexec
    SELECT 'CREATE DATABASE woodpecker'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'woodpecker')\gexec

    -- 创建用户（幂等）
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gitea') THEN
            CREATE USER gitea WITH PASSWORD '$GITEA_PASSWORD';
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'woodpecker') THEN
            CREATE USER woodpecker WITH PASSWORD '$WOODPECKER_PASSWORD';
        END IF;
    END
    \$\$;
EOSQL

# 切换到 gitea 库授予 schema 权限
psql -U "$POSTGRES_USER" -d gitea <<-EOSQL
    GRANT ALL ON SCHEMA public TO gitea;
    GRANT ALL PRIVILEGES ON DATABASE gitea TO gitea;
EOSQL

# 切换到 woodpecker 库授予 schema 权限
psql -U "$POSTGRES_USER" -d woodpecker <<-EOSQL
    GRANT ALL ON SCHEMA public TO woodpecker;
    GRANT ALL PRIVILEGES ON DATABASE woodpecker TO woodpecker;
EOSQL
