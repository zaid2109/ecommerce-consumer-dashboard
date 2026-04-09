const REQUIRED_SERVER_ENV = ['JWT_SECRET', 'DATABASE_URL', 'CONNECTOR_ENCRYPTION_KEY'] as const

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
}
