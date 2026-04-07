'use client'
import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import KPICard from '@/components/cards/KPICard'
import { useDataset } from '@/hooks/useDataset'
import { formatCurrency } from '@/lib/utils'
import WidgetErrorBoundary from '@/components/ui/WidgetErrorBoundary'

const ChartSkeleton = ({ h = 240 }: { h?: number }) => (
  <div className="animate-pulse rounded-card bg-[#1e2433]" style={{ height: h }} />
)

const OrdersAreaChart = dynamic(
  () => import('@/components/charts/OrdersAreaChart'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const OrdersByCategoryBar = dynamic(
  () => import('@/components/charts/OrdersByCategoryBar'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const OrderStatusDonut = dynamic(
  () => import('@/components/charts/OrderStatusDonut'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const DeliveryHistogram = dynamic(
  () => import('@/components/charts/DeliveryHistogram'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

export default function OrdersPage() {
  const { aggregated } = useDataset()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 100

  const kpis = useMemo(() => {
    const totalOrders = aggregated.topProducts.reduce((s, p) => s + p.orders, 0)
    const totalRevenue = aggregated.dailyRevenue.reduce((s, d) => s + d.gross, 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const payBreak = aggregated.paymentBreakdown
    let completed = 0, pending = 0, failed = 0
    Object.values(payBreak).forEach(v => {
      failed += v.failed
      completed += Math.round(v.count * 0.85)
      pending += v.count - Math.round(v.count * 0.85) - v.failed
    })

    return { totalOrders, avgOrderValue, pending, completed }
  }, [aggregated])

  const categoryData = useMemo(() =>
    aggregated.topProducts
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)
      .map(p => ({ name: p.category, orders: p.orders })),
    [aggregated]
  )

  const statusData = useMemo(() => [
    { name: 'Completed', value: kpis.completed, color: '#4ade80' },
    { name: 'Pending',   value: kpis.pending,   color: '#fb923c' },
    { name: 'Failed',    value: Math.round(kpis.totalOrders * 0.03), color: '#f87171' },
  ], [kpis])

  const ordersOverTime = useMemo(() => {
    const last90 = aggregated.dailyRevenue.slice(-90)
    return last90.map(d => ({
      date: d.date,
      orders: Math.round(d.gross / 250),
    }))
  }, [aggregated])

  const tableRows = useMemo(() => {
    const rows: {
      id: string; category: string; orders: number
      revenue: number; returnRate: number
    }[] = aggregated.topProducts.map((p, i) => ({
      id: `ORD-${String(i + 1).padStart(5, '0')}`,
      category: p.category,
      orders: p.orders,
      revenue: p.revenue,
      returnRate: p.returnRate,
    }))
    if (!search) return rows
    return rows.filter(r =>
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [aggregated, search])

  const pageRows = tableRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(tableRows.length / PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KPICard title="Total Orders" value={kpis.totalOrders.toLocaleString()} delta={8.2} deltaLabel="vs last month" variant="ring" ringPercent={71} />
        <KPICard title="Avg Order Value" value={formatCurrency(kpis.avgOrderValue)} delta={3.1} deltaLabel="vs last month" variant="ring" ringPercent={44} />
        <KPICard title="Pending Orders" value={kpis.pending.toLocaleString()} delta={-2.4} deltaLabel="vs yesterday" variant="ring" ringPercent={18} />
        <KPICard title="Completed" value={kpis.completed.toLocaleString()} delta={11.3} deltaLabel="vs last month" variant="ring" ringPercent={82} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3" style={{ background: '#141820', border: '1px solid #1e2433', borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Orders over time</p>
          <WidgetErrorBoundary title="Orders over time">
            <OrdersAreaChart data={ordersOverTime} />
          </WidgetErrorBoundary>
        </div>
        <div className="xl:col-span-2" style={{ background: '#141820', border: '1px solid #1e2433', borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Orders by category</p>
          <WidgetErrorBoundary title="Orders by category">
            <OrdersByCategoryBar data={categoryData} />
          </WidgetErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-2" style={{ background: '#141820', border: '1px solid #1e2433', borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Order status</p>
          <WidgetErrorBoundary title="Order status">
            <OrderStatusDonut data={statusData} />
          </WidgetErrorBoundary>
        </div>
        <div className="xl:col-span-3" style={{ background: '#141820', border: '1px solid #1e2433', borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Delivery time distribution</p>
          <WidgetErrorBoundary title="Delivery time distribution">
            <DeliveryHistogram aggregated={aggregated} />
          </WidgetErrorBoundary>
        </div>
      </div>

      <div style={{ background: '#141820', border: '1px solid #1e2433', borderRadius: 10, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>All orders</p>
          <label htmlFor="search-input" className="sr-only">Search</label>
          <input
            id="search-input"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search category or ID..."
            style={{
              background: '#0d0f14', border: '1px solid #1e2433',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#f1f5f9',
              outline: 'none', width: 220,
            }}
          />
        </div>

        <table className="st w-full" role="table" aria-label="Orders table">
          <thead>
            <tr>
              <th scope="col">Order ID</th>
              <th scope="col">Category</th>
              <th scope="col" className="text-right">Orders</th>
              <th scope="col" className="text-right">Revenue</th>
              <th scope="col" className="text-right">Return Rate</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row.id}>
                <td className="font-mono text-[#9ca3af] text-[11px]">{row.id}</td>
                <td className="font-medium">{row.category}</td>
                <td className="text-right">{row.orders.toLocaleString()}</td>
                <td className="text-right font-semibold">{formatCurrency(row.revenue)}</td>
                <td className="text-right">
                  <span style={{ color: row.returnRate > 0.15 ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                    {(row.returnRate * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-4" style={{ fontSize: 12, color: '#6b7280' }}>
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, tableRows.length)} of {tableRows.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{
              padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #1e2433', color: page === 0 ? '#4b5563' : '#9ca3af',
              cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{
              padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #1e2433', color: page >= totalPages - 1 ? '#4b5563' : '#9ca3af',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
