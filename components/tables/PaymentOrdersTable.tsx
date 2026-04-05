'use client'

import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatCurrency } from '@/lib/utils'
import VirtualTable from '@/components/tables/VirtualTable'
import { exportToCSV } from '@/lib/export'

type PaymentRow = {
  orderId: string
  date: Date
  method: string
  amount: number
  status: string
  segment: string
  category: string
}

type PaymentOrdersTableProps = {
  rows: PaymentRow[]
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Completed'
      ? 'bg-[#10b981]/10 text-[#10b981]'
      : status === 'Failed'
        ? 'bg-[#ef4444]/10 text-[#ef4444]'
        : 'bg-[#f59e0b]/10 text-[#f59e0b]'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{status}</span>
}

export function PaymentOrdersTable({ rows }: PaymentOrdersTableProps) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? rows.filter((r) => [r.orderId, r.method, r.segment, r.category].some((v) => String(v).toLowerCase().includes(q)))
      : rows
  }, [rows, query])

  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      { header: 'Order ID', accessorKey: 'orderId' },
      {
        header: 'Date',
        accessorKey: 'date',
        cell: ({ row }) => row.original.date.toLocaleDateString(),
      },
      { header: 'Method', accessorKey: 'method' },
      {
        header: 'Amount',
        accessorKey: 'amount',
        cell: ({ row }) => formatCurrency(row.original.amount),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      { header: 'Segment', accessorKey: 'segment' },
      { header: 'Category', accessorKey: 'category' },
    ],
    []
  )

  return (
    <VirtualTable
      columns={columns}
      data={filtered}
      rowHeight={48}
      searchQuery={query}
      onSearch={setQuery}
      onExportCSV={() => exportToCSV(filtered as Record<string, any>[], 'payments-orders.csv')}
    />
  )
}

export default PaymentOrdersTable

