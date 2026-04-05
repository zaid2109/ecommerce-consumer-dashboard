'use client'

import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { exportToCSV } from '@/lib/export'
import VirtualTable from '@/components/tables/VirtualTable'

type Row = {
  customerId: string
  name: string
  email: string
  segment: string
  totalOrders: number
  firstOrder: Date
  lastOrder: Date
  daysSinceLast: number
  totalSpent: number
}

type Props = { rows: Row[] }

type SortKey = keyof Pick<Row, 'name' | 'segment' | 'totalOrders' | 'firstOrder' | 'lastOrder' | 'daysSinceLast' | 'totalSpent'>

function SegmentBadge({ segment }: { segment: string }) {
  const color =
    segment === 'VIP'
      ? 'bg-[#6366f1]/10 text-[#6366f1]'
      : segment === 'Regular'
        ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]'
        : segment === 'At-Risk'
          ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
          : segment === 'Churned'
            ? 'bg-[#ef4444]/10 text-[#ef4444]'
            : 'bg-[#06b6d4]/10 text-[#06b6d4]'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{segment}</span>
}

export function AnalyticsCustomerTable({ rows }: Props) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalSpent')
  const [desc, setDesc] = useState(true)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    const base = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : rows
    return [...base].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av instanceof Date && bv instanceof Date) return desc ? bv.getTime() - av.getTime() : av.getTime() - bv.getTime()
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv
      return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
    })
  }, [rows, query, sortKey, desc])

  const onSort = (key: SortKey) => {
    if (sortKey === key) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(true)
    }
  }

  const columns: ColumnDef<Row>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Segment', accessorKey: 'segment', cell: ({ row }) => <SegmentBadge segment={row.original.segment} /> },
    { header: 'Orders', accessorKey: 'totalOrders', cell: ({ row }) => formatNumber(row.original.totalOrders) },
    { header: 'First', accessorKey: 'firstOrder', cell: ({ row }) => row.original.firstOrder.toLocaleDateString() },
    { header: 'Last', accessorKey: 'lastOrder', cell: ({ row }) => row.original.lastOrder.toLocaleDateString() },
    { header: 'Days Since', accessorKey: 'daysSinceLast' },
    { header: 'Spent', accessorKey: 'totalSpent', cell: ({ row }) => formatCurrency(row.original.totalSpent) },
  ]

  return (
    <VirtualTable
      columns={columns}
      data={filtered}
      rowHeight={48}
      searchQuery={query}
      onSearch={setQuery}
      onExportCSV={() => exportToCSV(filtered as Record<string, any>[], 'analytics-customers.csv')}
    />
  )
}

export default AnalyticsCustomerTable

