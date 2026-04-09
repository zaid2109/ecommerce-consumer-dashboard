import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:ops')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const runbooks = await prisma.runbook.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ runbooks })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:ops')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { name?: string; content?: string }
  const name = (body.name ?? '').trim()
  const content = (body.content ?? '').trim()
  if (!name || !content) return NextResponse.json({ error: 'name and content are required' }, { status: 400 })
  const runbook = await prisma.runbook.create({
    data: { workspaceId: auth.workspaceId, name, content },
  })
  return NextResponse.json({ runbook }, { status: 201 })
}
