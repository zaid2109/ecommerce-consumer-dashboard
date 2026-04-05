const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /dataWorker\.ts$/,
      type: 'asset/source',
    })
    return config
  },
}

module.exports = withBundleAnalyzer(nextConfig)
