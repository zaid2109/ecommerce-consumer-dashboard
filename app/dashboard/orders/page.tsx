'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import { useFilteredOrders } from '@/hooks/useChartData'
import { formatCurrency, formatNumber } from '@/lib/utils'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false })
const SpireTooltip = dynamic(() => import('@/components/charts/ChartTooltip'), { ssr: false })
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

type SortKey = 'id' | 'customer' | 'category' | 'product' | 'amount' | 'status' | 'date' | 'rating'

export default function OrdersPage() {
  const orders = useFilteredOrders()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDesc, setSortDesc] = useState(true)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return orders.filter((o) =>
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q)
    )
  }, [orders, query])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const dir = sortDesc ? -1 : 1
      switch (sortKey) {
        case 'id': return a.id.localeCompare(b.id) * dir
        case 'customer': return a.customerName.localeCompare(b.customerName) * dir
        case 'category': return a.category.localeCompare(b.category) * dir
        case 'product': return a.productName.localeCompare(b.productName) * dir
        case 'amount': return (a.revenue - b.revenue) * dir
        case 'status': return a.paymentStatus.localeCompare(b.paymentStatus) * dir
        case 'date': return (a.orderDate.getTime() - b.orderDate.getTime()) * dir
        case 'rating': return ((a.rating ?? 0) - (b.rating ?? 0)) * dir
      }
    })
    return rows
  }, [filtered, sortKey, sortDesc])

  const pageSize = 20
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))

  const statusCounts = useMemo(() => {
    const completed = orders.filter((o) => o.paymentStatus === 'Completed').length
    const pending = orders.filter((o) => o.paymentStatus === 'Pending').length
    const failed = orders.filter((o) => o.paymentStatus === 'Failed').length
    return { completed, pending, failed }
  }, [orders])

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.revenue, 0), [orders])
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0
  const spark = useMemo(() => orders.slice(-30).map((o) => o.revenue), [orders])

  const daily90 = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      const key = o.orderDate.toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-90).map(([date, count]) => ({ date, count }))
  }, [orders])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.category, (map.get(o.category) ?? 0) + 1)
    return Array.from(map.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)
  }, [orders])

  const deliveryBins = useMemo(() => {
    const bins = [
      { range: '1-3', count: 0 }, { range: '4-7', count: 0 }, { range: '8-10', count: 0 }, { range: '11-14', count: 0 },
    ]
    for (const o of orders) {
      if (o.deliveryDays <= 3) bins[0].count += 1
      else if (o.deliveryDays <= 7) bins[1].count += 1
      else if (o.deliveryDays <= 10) bins[2].count += 1
      else bins[3].count += 1
    }
    return bins
  }, [orders])

  const sortHeader = (key: SortKey, label: string) => (
    <button
      className={`inline-flex items-center gap-1 ${sortKey === key ? 'text-accent' : ''}`}
      onClick={() => {
        if (sortKey === key) setSortDesc((v) => !v)
        else { setSortKey(key); setSortDesc(true) }
      }}
    >
      {label}
      {sortKey === key ? (sortDesc ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null}
    </button>
  )

  return (
    <div className="space-y-6">
      <FilterBar />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KPICard title="Total Orders" value={formatNumber(orders.length)} delta={8.2} variant="ring" ringPercent={42} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg Order Value" value={formatCurrency(avgOrderValue)} delta={4.1} variant="ring" ringPercent={31} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Pending Orders" value={formatNumber(statusCounts.pending)} delta={-2.1} variant="ring" ringPercent={18} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Completed Orders" value={formatNumber(statusCounts.completed)} delta={6.5} variant="sparkline" sparklineData={spark} SparklineComponent={SparklineChart} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="sc">
          <div className="flex items-center justify-between mb-5"><div><h3 className="sc-title">Orders over time</h3><p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Daily last 90 days</p></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily90}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={(p) => <SpireTooltip {...p} />} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="sc">
          <div className="flex items-center justify-between mb-5"><div><h3 className="sc-title">Orders by category</h3><p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Sorted descending</p></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} layout="vertical">
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={(p) => <SpireTooltip {...p} />} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="sc">
          <div className="flex items-center justify-between mb-5"><div><h3 className="sc-title">Order status breakdown</h3><p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Completed / Pending / Failed</p></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip content={(p) => <SpireTooltip {...p} />} />
              <Pie data={[{ name: 'Completed', value: statusCounts.completed }, { name: 'Pending', value: statusCounts.pending }, { name: 'Failed', value: statusCounts.failed }]} dataKey="value" innerRadius={70} outerRadius={100}>
                <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="sc">
          <div className="flex items-center justify-between mb-5"><div><h3 className="sc-title">Delivery time distribution</h3><p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Days to deliver</p></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deliveryBins}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={(p) => <SpireTooltip {...p} />} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sc">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="sc-title">Orders table</h3>
            <p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Search, sort, and paginate</p>
          </div>
          <input className="w-full rounded-lg border border-border-light bg-page-light px-3 py-2 text-[13px] text-tx-primary outline-none dark:border-border-dark dark:bg-[#1e2433] dark:text-tx-inverse h-8 w-56" placeholder="Search orders..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} />
        </div>
        <table className="st w-full">
          <thead>
            <tr>
              <th>{sortHeader('id', 'Order ID')}</th>
              <th>{sortHeader('customer', 'Customer')}</th>
              <th>{sortHeader('category', 'Category')}</th>
              <th>{sortHeader('product', 'Product')}</th>
              <th className="text-right">{sortHeader('amount', 'Amount')}</th>
              <th>{sortHeader('status', 'Status')}</th>
              <th>{sortHeader('date', 'Date')}</th>
              <th>{sortHeader('rating', 'Rating')}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((o) => (
              <tr key={o.id}>
                <td>{o.id.slice(0, 8)}</td>
                <td>{o.customerName}</td>
                <td>{o.category}</td>
                <td>{o.productName}</td>
                <td className="text-right font-medium">{formatCurrency(o.revenue)}</td>
                <td>{o.paymentStatus}</td>
                <td>{o.orderDate.toISOString().slice(0, 10)}</td>
                <td>{o.rating ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-tx-secondary">
            Showing {sorted.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-tx-secondary hover:bg-[#f1f5f9] dark:text-tx-muted dark:hover:bg-[#1e2433] disabled:opacity-50" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
            <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-tx-secondary hover:bg-[#f1f5f9] dark:text-tx-muted dark:hover:bg-[#1e2433] disabled:opacity-50" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}





