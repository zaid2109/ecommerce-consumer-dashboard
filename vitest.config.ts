import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'lib/server/data-quality.ts',
        'lib/kpi-formulas.ts',
        'lib/server/mfa.ts',
        'lib/server/connector-secrets.ts',
        'lib/server/stripe-webhook.ts',
        'lib/server/auth.ts',
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
})
