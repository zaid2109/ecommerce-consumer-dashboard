'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFilterStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Beauty',
  'Books',
  'Toys',
  'Automotive',
  'Food',
  'Jewelry',
]

const SEGMENTS = ['VIP', 'Regular', 'New', 'At-Risk', 'Churned']
const COUNTRIES = ['United States', 'India', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia', 'Japan', 'Brazil', 'Singapore']
const PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet', 'Buy Now Pay Later', 'Cash on Delivery']
const PRESETS = ['7D', '30D', '90D', '1Y', 'All'] as const

function applyPresetDate(preset: (typeof PRESETS)[number]): [Date, Date] {
  const now = new Date()
  if (preset === 'All') return [new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()), now]
  const days = preset === '7D' ? 7 : preset === '30D' ? 30 : preset === '90D' ? 90 : 365
  return [new Date(now.getTime() - days * 86400000), now]
}

type FilterDropdownProps = {
  label: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
}

function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputId = `filter-search-${label.toLowerCase().replace(/\s+/g, '-')}`
  const filtered = useMemo(
    () => options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  )

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="ui-focus inline-flex items-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-medium text-tx-secondary transition hover:text-tx-primary dark:border-[#2a3246] dark:bg-[#111827] dark:text-tx-muted dark:hover:text-white">
          {value.length ? `${label} (${value.length})` : label}
          <ChevronDown size={12} className="ml-1" />
        </button>
      </Popover.Trigger>
      <Popover.Content align="start" className="w-64 p-3 sc z-50">
        <label htmlFor={inputId} className="sr-only">Search</label>
        <input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}...`}
          className="ui-focus mb-2 h-8 w-full rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-[12px] text-tx-primary placeholder:text-tx-muted dark:border-[#2a3246] dark:bg-[#0f131b] dark:text-tx-inverse"
        />
        <div className="max-h-56 overflow-y-auto space-y-1">
          {filtered.map((option) => {
            const selected = value.includes(option)
            return (
              <button
                key={option}
                onClick={() =>
                  onChange(selected ? value.filter((v) => v !== option) : [...value, option])
                }
                className="ui-focus flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-tx-secondary hover:bg-slate-100 dark:text-tx-muted dark:hover:bg-white/5"
              >
                <span className={cn('flex h-4 w-4 items-center justify-center rounded border', selected ? 'border-accent bg-accent text-white' : 'border-[#cbd5e1] dark:border-[#2a3246]')}>
                  {selected ? <Check size={11} /> : null}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}

export function FilterBar() {
  const store = useFilterStore()
  const [activePreset, setActivePreset] = useState<(typeof PRESETS)[number]>('All')
  const activeFilterCount =
    store.categories.length +
    store.segments.length +
    store.countries.length +
    store.paymentMethods.length

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset)
    store.setDateRange(applyPresetDate(preset))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap py-3 px-1 mb-2">
      <div className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-1 dark:border-[#2a3246] dark:bg-[#111827]">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className={`ui-focus rounded-md px-3 py-1 text-[12px] font-medium transition ${
              activePreset === preset
                ? 'bg-white text-accent shadow-sm dark:bg-white/10'
                : 'text-tx-secondary hover:text-tx-primary dark:text-tx-muted dark:hover:text-white'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <FilterDropdown label="Category" options={CATEGORIES} value={store.categories} onChange={store.setCategories} />
      <FilterDropdown label="Segment" options={SEGMENTS} value={store.segments} onChange={store.setSegments} />
      <FilterDropdown label="Country" options={COUNTRIES} value={store.countries} onChange={store.setCountries} />
      <FilterDropdown label="Payment" options={PAYMENT_METHODS} value={store.paymentMethods} onChange={store.setPaymentMethods} />

      {activeFilterCount > 0 && (
        <span className="pill bg-accent/10 text-accent">{activeFilterCount} active</span>
      )}

      {activeFilterCount > 0 && (
        <button onClick={store.resetFilters} className="ui-focus inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#f87171] hover:bg-[#7f1d1d]/15">
          <RotateCcw size={13} />
          Reset
        </button>
      )}
    </div>
  )
}
