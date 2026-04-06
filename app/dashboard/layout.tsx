'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAggregatedData } from '@/lib/data-store'

function DashboardLayoutSkeleton() {
  return (
    <div className="space-y-5 p-6 animate-pulse">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: '#1e2433', borderRadius: 10, height: 110 }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div style={{ gridColumn: 'span 3', background: '#1e2433', borderRadius: 10, height: 280 }} />
        <div style={{ gridColumn: 'span 2', background: '#1e2433', borderRadius: 10, height: 280 }} />
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading } = useAggregatedData()

  return <DashboardShell>{loading ? <DashboardLayoutSkeleton /> : children}</DashboardShell>
}
