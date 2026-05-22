const REQUIRED_SERVER_ENV = ['JWT_SECRET', 'DATABASE_URL', 'CONNECTOR_ENCRYPTION_KEY'] as const

// Variables that are required only when the relevant feature is active.
const CONDITIONAL_ENV: Record<string, () => boolean> = {
  STRIPE_WEBHOOK_SECRET: () => Boolean(process.env.STRIPE_SECRET_KEY),
  ARTIFACT_S3_BUCKET: () => ['s3', 'minio'].includes((process.env.ARTIFACT_STORAGE_PROVIDER ?? '').toLowerCase()),
  ARTIFACT_S3_ACCESS_KEY_ID: () => ['s3', 'minio'].includes((process.env.ARTIFACT_STORAGE_PROVIDER ?? '').toLowerCase()),
  ARTIFACT_S3_SECRET_ACCESS_KEY: () => ['s3', 'minio'].includes((process.env.ARTIFACT_STORAGE_PROVIDER ?? '').toLowerCase()),
}

export function requireEnv(name: (typeof REQUIRED_SERVER_ENV)[number]): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function validateRequiredServerEnv(): void {
  for (const key of REQUIRED_SERVER_ENV) {
    requireEnv(key)
  }
  for (const [key, isActive] of Object.entries(CONDITIONAL_ENV)) {
    if (isActive() && !process.env[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
