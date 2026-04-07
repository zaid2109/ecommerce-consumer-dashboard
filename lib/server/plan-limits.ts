import type { WorkspacePlan } from '@prisma/client'
import { prisma } from './prisma'

type PlanLimits = {
  seats: number
  connectors: number
  monthlyRows: number
}

const LIMITS: Record<WorkspacePlan, PlanLimits> = {
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

  const limits = LIMITS[workspace.plan]
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

