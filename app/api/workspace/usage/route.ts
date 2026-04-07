import { NextRequest, NextResponse } from 'next/server'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { getWorkspaceUsage } from '@/lib/server/plan-limits'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const usage = await getWorkspaceUsage(auth.workspaceId)
  return NextResponse.json(usage)
}

