import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export type AuthContext = {
  userId: string
  workspaceId: string
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'
}

const SECRET = process.env.JWT_SECRET || 'development-insecure-secret'
const ACCESS_TTL_SECONDS = 15 * 60
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

export function readAuthContext(req: NextRequest): AuthContext | null {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) {
    if (process.env.LOCAL_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production') {
      return {
        userId: process.env.LOCAL_TEST_USER_ID ?? 'local-test-user',
        workspaceId: process.env.LOCAL_TEST_WORKSPACE_ID ?? 'local-test-workspace',
        role: 'OWNER',
      }
    }
    return null
  }
  const token = header.slice('Bearer '.length)
  try {
    const decoded = jwt.verify(token, SECRET) as Partial<AuthContext>
    if (!decoded.userId || !decoded.workspaceId || !decoded.role) return null
    return {
      userId: decoded.userId,
      workspaceId: decoded.workspaceId,
      role: decoded.role,
    }
  } catch {
    return null
  }
}

export function canAccess(
  role: AuthContext['role'],
  action: 'dataset:read' | 'dataset:write' | 'member:manage' | 'invite:manage'
): boolean {
  if (role === 'OWNER') return true
  if (role === 'ADMIN') return true
  if (role === 'ANALYST') return action === 'dataset:read' || action === 'dataset:write'
  if (role === 'VIEWER') return action === 'dataset:read'
  return false
}

function signAccessToken(payload: AuthContext): string {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_TTL_SECONDS })
}

function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

async function hashToken(raw: string): Promise<string> {
  return bcrypt.hash(raw, 12)
}

async function verifyToken(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash)
}

export async function createAuthSession(input: {
  userId: string
  workspaceId: string
  role: AuthContext['role']
  ip?: string | null
  userAgent?: string | null
}): Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresAt: Date }> {
  const accessToken = signAccessToken({
    userId: input.userId,
    workspaceId: input.workspaceId,
    role: input.role,
  })
  const refreshToken = newRefreshToken()
  const refreshHash = await hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      refreshTokenHash: refreshHash,
      expiresAt,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: session.id,
      metadata: { ip: input.ip ?? null, userAgent: input.userAgent ?? null },
    },
  })

  return { accessToken, refreshToken, sessionId: session.id, expiresAt }
}

export async function rotateRefreshSession(input: {
  sessionId: string
  refreshToken: string
  ip?: string | null
  userAgent?: string | null
}): Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresAt: Date; auth: AuthContext } | null> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) return null

  const ok = await verifyToken(input.refreshToken, session.refreshTokenHash)
  if (!ok) return null

  const auth: AuthContext = {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    role: session.user.role,
  }
  const accessToken = signAccessToken(auth)
  const refreshToken = newRefreshToken()
  const refreshHash = await hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: refreshHash,
      expiresAt,
      ip: input.ip ?? session.ip ?? undefined,
      userAgent: input.userAgent ?? session.userAgent ?? undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.refresh',
      resourceType: 'session',
      resourceId: session.id,
      metadata: { ip: input.ip ?? null, userAgent: input.userAgent ?? null },
    },
  })

  return { accessToken, refreshToken, sessionId: session.id, expiresAt, auth }
}

export async function revokeSession(input: { sessionId: string; workspaceId: string; userId?: string | null }) {
  await prisma.session.deleteMany({
    where: {
      id: input.sessionId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: input.sessionId,
      metadata: {},
    },
  })
}
