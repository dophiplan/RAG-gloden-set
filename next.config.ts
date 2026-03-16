import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production output optimization for Vercel
  output: 'standalone',

  // Compression
  compress: true,

  // Turbopack configuration (empty = use defaults)
  turbopack: {},

  // Webpack configuration for optional dependencies
  webpack: (config, { isServer }) => {
    // Handle optional native dependencies
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'better-sqlite3': false,
      };
    }
    
    // Mark better-sqlite3 as external (it's optional)
    config.externals.push('better-sqlite3');
    
    return config;
  },

  // Experimental optimizations
  experimental: {
    // Optimize package imports for commonly used libraries
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'react-icons',
      'date-fns',
    ],
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    // Cache optimized images
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Security headers with performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com",
            ].join('; '),
          },
        ],
      },
      // Cache static assets
      {
        source: '/:all*(svg|jpg|png|webp|avif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
