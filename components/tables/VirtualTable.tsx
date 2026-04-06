'use client'

import { useEffect, useState } from 'react'
import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table'
import { TableVirtuoso } from 'react-virtuoso'
import * as Popover from '@radix-ui/react-popover'
import { Columns3 } from 'lucide-react'
import useDebounce from '@/hooks/useDebounce'

type VirtualTableProps<TData extends Record<string, any>> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  rowHeight?: number
  searchQuery?: string
  onSearch?: (q: string) => void
  onExportCSV?: () => void
}

export function VirtualTable<TData extends Record<string, any>>({
  columns,
  data,
  rowHeight = 48,
  searchQuery = '',
  onSearch,
  onExportCSV,
}: VirtualTableProps<TData>) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const debounced = useDebounce(localQuery, 300)

  useEffect(() => {
    onSearch?.(debounced)
  }, [debounced, onSearch])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    state: { sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section className="sc sc-interactive p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor="virtual-table-search" className="sr-only">Search</label>
        <input
          id="virtual-table-search"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search..."
          className="ui-focus h-9 rounded-lg border border-[#2a3246] bg-[#0f131b] px-3 text-sm text-tx-primary placeholder:text-tx-muted"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-tx-muted">{table.getRowModel().rows.length} rows (virtualized)</span>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button aria-label="Toggle visible columns" className="ui-focus inline-flex items-center gap-1 rounded-lg border border-[#2a3246] bg-[#111827] px-2 py-1 text-xs text-tx-secondary transition-all duration-200 hover:-translate-y-[1px] hover:border-[#334155]">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={6}
                className="z-50 w-52 rounded-lg border border-[#2a3246] bg-[#141820] p-3 shadow-lg"
              >
                <div className="space-y-2">
                  {table.getAllLeafColumns().map((col) => (
                    <label key={col.id} className="flex items-center gap-2 text-xs text-tx-secondary">
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={() => col.toggleVisibility()}
                      />
                      {String(col.columnDef.header ?? col.id)}
                    </label>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          {onExportCSV ? (
            <button onClick={onExportCSV} className="ui-focus rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-medium text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#5558e3]">
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      <div className="h-[520px] overflow-hidden rounded-lg border border-[#2a3246] bg-[#0f131b]">
        <TableVirtuoso
          data={table.getRowModel().rows}
          fixedHeaderContent={() => (
            <tr className="bg-[#141820]">
              {table.getHeaderGroups()[0].headers.map((header) => (
                <th
                  scope="col"
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="sticky top-0 cursor-pointer border-b border-[#2a3246] px-3 py-2 text-left text-xs uppercase tracking-wide text-tx-secondary"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          )}
          itemContent={(_, row) =>
            row.getVisibleCells().map((cell) => (
              <td key={cell.id} style={{ height: rowHeight }} className="border-b border-[#20293c] px-3 py-2 text-sm text-[#d1d5db]">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))
          }
        />
      </div>
    </section>
  )
}

export default VirtualTable
