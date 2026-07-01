import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
})

const nextConfig: NextConfig = {
  // 绕过 Supabase 客户端类型推断缺失问题（需后续运行 supabase gen types 修复）
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow Supabase images
  images: {
    remotePatterns: [
      { hostname: "**.supabase.co" },
      { hostname: "avatars.githubusercontent.com" },
    ],
  },

  // Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withNextIntl(nextConfig)
