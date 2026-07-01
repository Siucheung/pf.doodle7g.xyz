# ============================================================
# OpsPilot - Docker 部署镜像
# 用于 Render.com 等平台的 Docker 部署
# ============================================================
# 构建方式：
#   docker build -t opspilot .
#   docker run -p 3000:3000 --env-file .env opspilot
# ============================================================

# ---- Stage 1: 构建 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 仅复制依赖配置以利用缓存
COPY package.json package-lock.json* ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ---- Stage 2: 运行 ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 安装运行时工具
RUN apk add --no-cache curl ca-certificates tzdata

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 从构建阶段复制产出的文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# 所有权
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/ping > /dev/null || exit 1

CMD ["npm", "run", "start"]
