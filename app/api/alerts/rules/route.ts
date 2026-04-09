import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rules = await prisma.alertRule.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    metric?: string
    type?: 'THRESHOLD' | 'ANOMALY'
    comparator?: string
    threshold?: number
    channels?: Array<'EMAIL' | 'SLACK'>
    slackWebhook?: string
    emailTargets?: string[]
    enabled?: boolean
  }

  const name = (body.name ?? '').trim()
  const metric = (body.metric ?? '').trim()
  if (!name || !metric) return NextResponse.json({ error: 'Name and metric are required' }, { status: 400 })

  const rule = await prisma.alertRule.create({
    data: {
      workspaceId: auth.workspaceId,
      createdById: auth.userId,
      name,
      metric,
      type: body.type === 'ANOMALY' ? 'ANOMALY' : 'THRESHOLD',
      comparator: (body.comparator ?? '>=').trim(),
      threshold: typeof body.threshold === 'number' ? body.threshold : null,
      channels: (body.channels ?? ['EMAIL']) as Array<'EMAIL' | 'SLACK'>,
      slackWebhook: body.slackWebhook?.trim() || null,
      emailTargets: Array.isArray(body.emailTargets) ? body.emailTargets.filter((e) => e.trim().length > 0) : [],
      enabled: body.enabled ?? true,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'alert_rule.create',
      resourceType: 'alert_rule',
      resourceId: rule.id,
      metadata: { metric: rule.metric, type: rule.type },
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}
