import { describe, expect, it } from 'vitest'
import { evaluateDatasetQuality, toRejectCsv } from '@/lib/server/data-quality'
import type { ColumnMapping } from '@/lib/dataset-store'

const mapping: ColumnMapping = {
  orderId: 'order_id',
  date: 'order_date',
  revenue: 'amount',
  category: null,
  quantity: 'qty',
  unitPrice: 'unit_price',
  customerName: 'customer',
  customerSegment: null,
  country: null,
  paymentMethod: null,
  paymentStatus: null,
  isReturned: null,
  returnReason: null,
  rating: null,
  discount: null,
  productName: 'product',
}

describe('data-quality', () => {
  it('splits valid and rejected rows and computes stable fingerprint', () => {
    const rows = [
      {
        order_id: 'A-1',
        order_date: '2026-01-01',
        amount: '120.50',
        qty: '2',
        unit_price: '60.25',
        customer: 'Alice',
        product: 'Widget',
      },
      {
        order_id: '',
        order_date: 'not-a-date',
        amount: '10',
        qty: '1',
        unit_price: '10',
        customer: 'Bob',
        product: 'Gadget',
      },
    ] as Array<Record<string, unknown>>

    const result = evaluateDatasetQuality(rows, mapping)
    expect(result.validRows).toHaveLength(1)
    expect(result.rejectedRows).toHaveLength(1)
    expect(result.rejectedRows[0].__reject_reason).toBe('Missing orderId')
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.mappingFingerprint).toMatch(/^[a-f0-9]{64}$/)

    const result2 = evaluateDatasetQuality(rows, mapping)
    expect(result.mappingFingerprint).toBe(result2.mappingFingerprint)
  })

  it('generates reject CSV including reason field', () => {
    const csv = toRejectCsv([
      { order_id: 'B-1', __reject_reason: 'Invalid revenue' },
      { order_id: 'B-2', __reject_reason: 'Missing productName' },
    ])
    expect(csv).toContain('__reject_reason')
    expect(csv).toContain('Invalid revenue')
    expect(csv).toContain('Missing productName')
  })
})
