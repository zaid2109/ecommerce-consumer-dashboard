import type { WorkspacePlan, Prisma } from '@prisma/client'
import { prisma } from './prisma'

type PlanLimits = {
  seats: number
  connectors: number
  monthlyRows: number
}

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  STARTER: { seats: 1, connectors: 0, monthlyRows: 200_000 },
  GROWTH: { seats: 10, connectors: 20, monthlyRows: 5_000_000 },
  ENTERPRISE: { seats: 100, connectors: 100, monthlyRows: 50_000_000 },
}

export async function getWorkspaceUsage(workspaceId: string) {
  const [workspace, seats, connectors, rows] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    }),
    prisma.user.count({ where: { workspaceId } }),
    prisma.connector.count({ where: { workspaceId } }),
    prisma.dataset.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { rowCount: true },
    }),
  ])

  if (!workspace) {
    throw new Error('Workspace not found')
  }

  const limits = PLAN_LIMITS[workspace.plan]
  const monthlyRows = rows._sum.rowCount ?? 0

  return {
    plan: workspace.plan,
    limits,
    usage: {
      seats,
      connectors,
      monthlyRows,
    },
  }
}

// Non-atomic advisory check — suitable for connectors/rows where slight overcount is tolerable.
export async function checkPlanLimit(input: {
  workspaceId: string
  metric: keyof PlanLimits
  increment?: number
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const increment = input.increment ?? 1
  const data = await getWorkspaceUsage(input.workspaceId)
  const current = data.usage[input.metric]
  const limit = data.limits[input.metric]
  if (current + increment > limit) {
    return {
      ok: false,
      message: `Plan limit exceeded for ${input.metric}. Current plan ${data.plan} allows up to ${limit}.`,
    }
  }
  return { ok: true }
}

type CreatedUser = { id: string; email: string; role: import('@prisma/client').UserRole; createdAt: Date }

// Atomic seat check: count inside the same transaction that creates the user record.
// Caller provides the Prisma transaction client and the create data.
export async function atomicCreateUserWithSeatCheck(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  createData: Prisma.UserCreateInput
): Promise<{ ok: true; user: CreatedUser } | { ok: false; message: string }> {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  })
  if (!workspace) return { ok: false, message: 'Workspace not found' }

  const limit = PLAN_LIMITS[workspace.plan].seats
  const current = await tx.user.count({ where: { workspaceId } })

  if (current >= limit) {
    return {
      ok: false,
      message: `Plan limit exceeded for seats. Current plan ${workspace.plan} allows up to ${limit}.`,
    }
  }

  const user = await tx.user.create({ data: createData, select: { id: true, email: true, role: true, createdAt: true } })
  return { ok: true, user }
}

