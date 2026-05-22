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
    const isProduction = process.env.NODE_ENV === 'production'

    // In dev, webpack HMR requires 'unsafe-eval' (source maps / fast-refresh runtime)
    // and blob: (dynamic chunk loading). Neither is allowed in production.
    const scriptSrc = isProduction
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"

    const styleSrc = isProduction
      ? "style-src 'self'"
      : "style-src 'self' 'unsafe-inline'"

    // Dev HMR uses a WebSocket on the same host; allow it explicitly.
    const connectSrc = isProduction
      ? "connect-src 'self' https:"
      : "connect-src 'self' https: ws://localhost:* wss://localhost:*"

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      styleSrc,
      scriptSrc,
      "script-src-attr 'none'",
      connectSrc,
      "form-action 'self'",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
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
