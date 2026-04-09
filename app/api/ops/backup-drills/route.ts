import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { writeJsonArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:ops')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const drills = await prisma.backupDrill.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { startedAt: 'desc' },
  })
  return NextResponse.json({ drills })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:ops')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { notes?: string; status?: 'PASSED' | 'FAILED' }
  const started = new Date()
  const drill = await prisma.backupDrill.create({
    data: {
      workspaceId: auth.workspaceId,
      triggeredById: auth.userId,
      status: body.status === 'FAILED' ? 'FAILED' : 'PASSED',
      notes: body.notes?.trim() || null,
      startedAt: started,
      completedAt: new Date(),
    },
  })
  await writeJsonArtifact(`ops/backup-drills/${auth.workspaceId}/${drill.id}.json`, {
    drillId: drill.id,
    status: drill.status,
    notes: drill.notes,
    startedAt: started.toISOString(),
    completedAt: new Date().toISOString(),
  })
  return NextResponse.json({ drill }, { status: 201 })
}
