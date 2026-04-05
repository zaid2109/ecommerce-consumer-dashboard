'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'
import { useTheme } from 'next-themes'
import { useDataset } from '@/hooks/useDataset'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { orders, isUploaded } = useDataset()

  return (
    <div className="space-y-6">
      <section className="sc">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-tx-primary">Appearance</h2>
        <RadioGroup.Root
          value={theme}
          onValueChange={(value) => setTheme(value)}
          className="flex gap-3"
        >
          {['light', 'dark', 'system'].map((mode) => (
            <label key={mode} className="ui-focus inline-flex items-center gap-2 rounded-lg border border-[#2a3246] bg-[#0f131b] px-3 py-2 text-sm text-[#d1d5db]">
              <RadioGroup.Item value={mode} className="h-4 w-4 rounded-full border border-[#6366f1] data-[state=checked]:bg-[#6366f1]" />
              {mode[0].toUpperCase() + mode.slice(1)}
            </label>
          ))}
        </RadioGroup.Root>
      </section>

      <section className="sc">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-tx-primary">Data</h2>
        <p className="text-sm text-tx-secondary">Total records loaded: {orders.length.toLocaleString()}</p>
        <p className="text-sm text-tx-secondary">Data source: {isUploaded ? 'Uploaded dataset' : 'Demo dataset'}</p>
      </section>

      <section className="sc">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-tx-primary">About</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-tx-secondary">
          <li>Next.js 14 + App Router</li>
          <li>TypeScript + Zustand + Recharts</li>
          <li>TanStack Table + React Virtuoso</li>
          <li>Web Worker powered data generation</li>
        </ul>
      </section>
    </div>
  )
}






