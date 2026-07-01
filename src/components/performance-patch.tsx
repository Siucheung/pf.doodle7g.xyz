'use client'

import { useEffect } from 'react'

/**
 * Next.js 16 + Turbopack 开发模式下的上游 React Bug 补丁
 *
 * Bug: React 的 performance instrumentation 在组件被拒绝/中止时
 * 使用 -Infinity 作为时间戳调用 performance.measure()，导致：
 *   "Failed to execute 'measure' on 'Performance': cannot have a negative time stamp"
 *
 * 上游跟踪:
 *   https://github.com/vercel/next.js/issues/86060
 *   https://github.com/vercel/next.js/pull/88688 (已关闭，等待 React 上游修复)
 *
 * 影响: 仅开发模式 + Turbopack，生产构建不受影响
 */
export function PerformancePatch() {
  useEffect(() => {
    // 仅开发模式需要
    if (process.env.NODE_ENV !== 'development') return

    const perf = window.performance
    if (!perf || typeof perf.measure !== 'function') return

    const originalMeasure = perf.measure.bind(perf)

    perf.measure = ((...args: Parameters<Performance['measure']>) => {
      try {
        return originalMeasure(...args)
      } catch {
        // 静默忽略负时间戳错误
        return undefined
      }
    }) as typeof perf.measure
  }, [])

  return null
}
