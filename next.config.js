/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize barrel imports — prevents importing entire recharts/lucide bundles
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      'date-fns',
    ],
  },

  webpack: (config, { isServer, dev }) => {
    // Web Worker support
    config.output.globalObject = 'self'

    // Prevent server-side bundling of browser-only modules
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    // Bundle analyzer (only when ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('@next/bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false })
      )
    }

    return config
  },

  // Security headers
  async headers() {
    const allowUnsafeInline =
      process.env.CSP_ALLOW_UNSAFE_INLINE === 'true' ||
      process.env.NODE_ENV !== 'production'
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      allowUnsafeInline ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
      allowUnsafeInline ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
      "connect-src 'self' https:",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
