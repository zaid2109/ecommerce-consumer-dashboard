import { describe, expect, it } from 'vitest'
import { KPI_FORMULAS } from '@/lib/kpi-formulas'

describe('kpi-formulas', () => {
  it('calculates return rates deterministically', () => {
    expect(KPI_FORMULAS.returnRatePercent(200, 10)).toBe(5)
    expect(KPI_FORMULAS.returnRatePercent(0, 10)).toBe(0)
    expect(KPI_FORMULAS.categoryReturnRateRatio(50, 5)).toBe(0.1)
  })

  it('uses deterministic scatter sampling by customerId sort', () => {
    const sampled = KPI_FORMULAS.deterministicScatterSample(
      [{ customerId: 'c-20' }, { customerId: 'c-01' }, { customerId: 'c-10' }],
      2
    )
    expect(sampled).toEqual([{ customerId: 'c-01' }, { customerId: 'c-10' }])
  })
})
