import { NextRequest, NextResponse } from 'next/server'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sales')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as {
    monthlyRevenue?: number
    analystHoursPerMonth?: number
    avgHourlyCost?: number
    expectedEfficiencyGainPercent?: number
    platformMonthlyCost?: number
  }

  const monthlyRevenue = Math.max(0, body.monthlyRevenue ?? 0)
  const analystHours = Math.max(0, body.analystHoursPerMonth ?? 0)
  const hourlyCost = Math.max(0, body.avgHourlyCost ?? 0)
  const gain = Math.max(0, body.expectedEfficiencyGainPercent ?? 0) / 100
  const platformCost = Math.max(0, body.platformMonthlyCost ?? 0)

  const timeSavingsValue = analystHours * hourlyCost * gain
  const revenueUplift = monthlyRevenue * (gain * 0.25)
  const grossBenefit = timeSavingsValue + revenueUplift
  const netBenefit = grossBenefit - platformCost
  const roiPercent = platformCost > 0 ? (netBenefit / platformCost) * 100 : 0
  const paybackMonths = netBenefit > 0 ? platformCost / netBenefit : null

  return NextResponse.json({
    inputs: {
      monthlyRevenue,
      analystHoursPerMonth: analystHours,
      avgHourlyCost: hourlyCost,
      expectedEfficiencyGainPercent: gain * 100,
      platformMonthlyCost: platformCost,
    },
    outputs: {
      timeSavingsValue,
      revenueUplift,
      grossBenefit,
      netBenefit,
      roiPercent,
      paybackMonths,
    },
  })
}
