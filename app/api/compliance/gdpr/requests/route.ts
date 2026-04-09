import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { writeJsonArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const requests = await prisma.gdprRequest.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as {
    requestType?: 'EXPORT' | 'DELETE'
    subjectEmail?: string
  }
  const requestType = body.requestType === 'DELETE' ? 'DELETE' : 'EXPORT'
  const subjectEmail = (body.subjectEmail ?? '').trim().toLowerCase()
  if (!subjectEmail) return NextResponse.json({ error: 'subjectEmail is required' }, { status: 400 })

  const created = await prisma.gdprRequest.create({
    data: {
      workspaceId: auth.workspaceId,
      requestedById: auth.userId,
      requestType,
      subjectEmail,
    },
  })

  if (requestType === 'EXPORT') {
    const [user, sessions, datasets] = await Promise.all([
      prisma.user.findUnique({ where: { email: subjectEmail }, select: { id: true, email: true, createdAt: true, lastLogin: true } }),
      prisma.session.findMany({
        where: {
          user: { email: subjectEmail, workspaceId: auth.workspaceId },
        },
        select: { id: true, expiresAt: true, ip: true, userAgent: true },
      }),
      prisma.dataset.findMany({
        where: { workspaceId: auth.workspaceId, createdBy: { email: subjectEmail } },
        select: { id: true, name: true, status: true, createdAt: true, rowCount: true },
      }),
    ])
    const key = `gdpr/${auth.workspaceId}/${created.id}.json`
    await writeJsonArtifact(key, {
      exportedAt: new Date().toISOString(),
      subjectEmail,
      user,
      sessions,
      datasets,
    })
    await prisma.gdprRequest.update({
      where: { id: created.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        artifactKey: key,
      },
    })
  } else {
    await prisma.session.deleteMany({
      where: { user: { email: subjectEmail, workspaceId: auth.workspaceId } },
    })
    await prisma.user.deleteMany({
      where: { email: subjectEmail, workspaceId: auth.workspaceId },
    })
    await prisma.gdprRequest.update({
      where: { id: created.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  }

  const requestRecord = await prisma.gdprRequest.findUnique({ where: { id: created.id } })
  return NextResponse.json({ request: requestRecord }, { status: 201 })
}
