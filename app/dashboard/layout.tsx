import { Suspense } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import DataLoadingScreen from '@/components/DataLoadingScreen'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardShell>
      <Suspense fallback={<DataLoadingScreen />}>
        <DataLoadingScreen />
        {children}
      </Suspense>
    </DashboardShell>
  )
}
