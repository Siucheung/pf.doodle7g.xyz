import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
})

const nextConfig: NextConfig = {
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
