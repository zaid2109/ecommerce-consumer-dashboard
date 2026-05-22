import { describe, expect, it, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-32-bytes-long-enough!!'
  process.env.DATABASE_URL = 'postgresql://localhost/test'
  process.env.CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64')
})

// Dynamic import after env is set to avoid module-level env validation throw.
let canAccess: (role: string, action: string) => boolean

beforeAll(async () => {
  const mod = await import('@/lib/server/auth')
  canAccess = mod.canAccess as typeof canAccess
})

describe('auth permission matrix', () => {
  it('allows OWNER for all admin actions', () => {
    expect(canAccess('OWNER', 'admin:billing')).toBe(true)
    expect(canAccess('OWNER', 'admin:compliance')).toBe(true)
    expect(canAccess('OWNER', 'admin:sso')).toBe(true)
    expect(canAccess('OWNER', 'admin:ops')).toBe(true)
    expect(canAccess('OWNER', 'admin:sales')).toBe(true)
  })

  it('restricts ADMIN from sensitive enterprise controls', () => {
    expect(canAccess('ADMIN', 'admin:billing')).toBe(false)
    expect(canAccess('ADMIN', 'admin:compliance')).toBe(false)
    expect(canAccess('ADMIN', 'admin:sso')).toBe(false)
  })

  it('allows ADMIN for operational and sales controls', () => {
    expect(canAccess('ADMIN', 'admin:ops')).toBe(true)
    expect(canAccess('ADMIN', 'admin:sales')).toBe(true)
  })

  it('restricts ANALYST and VIEWER to data access scopes only', () => {
    expect(canAccess('ANALYST', 'dataset:read')).toBe(true)
    expect(canAccess('ANALYST', 'dataset:write')).toBe(true)
    expect(canAccess('ANALYST', 'admin:ops')).toBe(false)
    expect(canAccess('VIEWER', 'dataset:read')).toBe(true)
    expect(canAccess('VIEWER', 'dataset:write')).toBe(false)
    expect(canAccess('VIEWER', 'admin:sales')).toBe(false)
  })
})
