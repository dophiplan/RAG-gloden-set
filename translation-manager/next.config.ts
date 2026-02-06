import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API Routes body size limit
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // 50MB limit for server actions
    },
  },

  // Increase max body size for API routes
  // Note: This is handled by route configuration in App Router
};

export default nextConfig;
