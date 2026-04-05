'use client'

import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { exportToCSV } from '@/lib/export'
import VirtualTable from '@/components/tables/VirtualTable'

type Row = {
  name: string
  email: string
  segment: string
  rfmScore: number
  totalOrders: number
  totalSpent: number
  lastOrder: Date
  daysSinceLast: number
}

type Props = { rows: Row[] }

export function CustomersTable({ rows }: Props) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : rows
  }, [rows, query])

  const columns: ColumnDef<Row>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Segment', accessorKey: 'segment' },
    { header: 'RFM', accessorKey: 'rfmScore' },
    { header: 'Orders', accessorKey: 'totalOrders', cell: ({ row }) => formatNumber(row.original.totalOrders) },
    { header: 'Spent', accessorKey: 'totalSpent', cell: ({ row }) => formatCurrency(row.original.totalSpent) },
    { header: 'Last Order', accessorKey: 'lastOrder', cell: ({ row }) => row.original.lastOrder.toLocaleDateString() },
    { header: 'Days Since', accessorKey: 'daysSinceLast' },
  ]

  return (
    <VirtualTable
      columns={columns}
      data={filtered}
      rowHeight={48}
      searchQuery={query}
      onSearch={setQuery}
      onExportCSV={() => exportToCSV(filtered as Record<string, any>[], 'customers.csv')}
    />
  )
}

export default CustomersTable

