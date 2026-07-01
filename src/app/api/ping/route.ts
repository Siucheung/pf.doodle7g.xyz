/**
 * 健康检查端点
 *
 * 用途：
 * 1. Render 容器的 Health Check 目标
 * 2. cron-job.org / UptimeRobot 等免费 keepalive 服务的目标
 * 3. 在自举监控中作为"运维平台自身存活"检测端点
 *
 * 无认证要求，返回轻量 JSON。
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const start = Date.now()

  return NextResponse.json({
    status: 'ok',
    service: 'OpsPilot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    region: process.env.RENDER_REGION || process.env.VERCEL_REGION || 'local',
    memory: process.memoryUsage(),
  })
}
