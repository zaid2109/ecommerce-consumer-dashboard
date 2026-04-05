'use client'

import { CHART_PALETTE, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

type TopProductRow = {
  rank: number
  category: string
  orders: number
  revenue: number
  returnRate: number
}

type TopProductsTableProps = {
  data: TopProductRow[]
  title?: string
}

export function TopProductsTable({ data, title = 'Bestselling products' }: TopProductsTableProps) {
  return (
    <div className="w-full">
      <div className="mb-3.5">
        <h3 className="sc-title">{title}</h3>
      </div>
      <table className="st w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>Category</th>
            <th className="text-right">Orders</th>
            <th className="text-right">Revenue</th>
            <th className="text-right">Return %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={`${row.category}-${i}`}>
              <td className="text-tx-muted font-medium w-8">{i + 1}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_PALETTE[i % 6] }} />
                  <span className="font-medium">{row.category}</span>
                </div>
              </td>
              <td className="text-right">{formatNumber(row.orders)}</td>
              <td className="text-right font-medium">{formatCurrency(row.revenue)}</td>
              <td className="text-right">
                <span className={row.returnRate > 15 ? 'text-danger' : 'text-success'}>
                  {formatPercent(row.returnRate, 1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TopProductsTable

