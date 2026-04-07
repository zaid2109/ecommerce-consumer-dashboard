import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export function createCsrfToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function enforceCsrf(req: NextRequest): NextResponse | null {
  const hasSessionCookie = Boolean(
    req.cookies.get('session_id')?.value || req.cookies.get('refresh_token')?.value
  )
  if (!hasSessionCookie) return null

  const cookieToken = req.cookies.get('csrf_token')?.value
  const headerToken = req.headers.get('x-csrf-token')
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }
  return null
}

