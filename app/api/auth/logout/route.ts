import { NextRequest, NextResponse } from 'next/server'
import { readAuthContext, revokeSession } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  const sessionId = req.cookies.get('session_id')?.value

  if (sessionId && auth) {
    await revokeSession({
      sessionId,
      workspaceId: auth.workspaceId,
      userId: auth.userId,
    })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('access_token', '', { httpOnly: true, path: '/', expires: new Date(0) })
  response.cookies.set('refresh_token', '', { httpOnly: true, path: '/', expires: new Date(0) })
  response.cookies.set('session_id', '', { httpOnly: true, path: '/', expires: new Date(0) })
  return response
}
