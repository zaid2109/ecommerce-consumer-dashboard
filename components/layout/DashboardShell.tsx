'use client'
import { useState } from 'react'
import { Suspense } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { DatasetBanner } from '@/components/upload/DatasetBanner'
import { SavedViewsControl } from './SavedViewsControl'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const sidebarWidth = collapsed ? 72 : 240

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Header sidebarWidth={sidebarWidth} />
      <main className="min-h-screen bg-page-light dark:bg-page-dark transition-all duration-300" style={{ marginLeft: sidebarWidth, paddingTop: 64 }}>
        <div className="p-6 max-w-[1600px]">
          <DatasetBanner />
          <Suspense fallback={null}>
            <SavedViewsControl />
          </Suspense>
          {children}
        </div>
      </main>
    </>
  )
}
