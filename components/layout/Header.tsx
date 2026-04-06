'use client'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Search, Bell, Sun, Moon, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { UploadModal } from '@/components/upload/UploadModal'
import { useDatasetStore } from '@/lib/dataset-store'

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/customers': 'Customers',
  '/dashboard/orders': 'Orders',
  '/dashboard/products': 'Products',
  '/dashboard/returns': 'Returns',
  '/dashboard/payments': 'Payments',
  '/dashboard/settings': 'Settings',
}

interface HeaderProps { sidebarWidth: number }

export function Header({ sidebarWidth }: HeaderProps) {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const { activeDataset } = useDatasetStore()

  useEffect(() => setMounted(true), [])
  const title = TITLES[pathname] ?? 'Dashboard'

  return (
    <>
      <header
        className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 h-16 transition-all duration-300 bg-page-light/95 dark:bg-page-dark/95 border-b border-border-dark backdrop-blur-md"
        style={{ left: sidebarWidth }}
      >
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-tx-primary dark:text-tx-inverse">{title}</h1>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
            <label htmlFor="header-search-input" className="sr-only">Search</label>
            <input
              id="header-search-input"
              readOnly
              placeholder="Search..."
              className="ui-focus h-9 w-[220px] rounded-full pl-8 pr-4 text-[13px] bg-[#f8fafc] dark:bg-[#1a2233] text-tx-primary dark:text-tx-inverse placeholder:text-tx-muted border border-[#e2e8f0] dark:border-[#2a3246] cursor-pointer"
            />
          </div>

          <button
            onClick={() => setShowUpload(true)}
            className={`ui-focus inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all duration-200 hover:-translate-y-[1px] ${
              activeDataset
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/15'
                : 'bg-[#1a2233] border-[#2a3246] text-[#cbd5e1] hover:bg-[#202a3f] hover:text-[#f1f5f9]'
            }`}
            title={activeDataset ? 'A custom dataset is active' : 'Upload a dataset'}
          >
            <Upload size={14} />
            {activeDataset ? 'Dataset active' : 'Upload data'}
          </button>

          {mounted && (
            <button aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="ui-focus w-9 h-9 rounded-full flex items-center justify-center text-tx-secondary dark:text-tx-muted hover:bg-[#f1f5f9] dark:hover:bg-[#1e2433] transition-colors">
              {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}

          <button aria-label="View notifications" className="ui-focus relative w-9 h-9 rounded-full flex items-center justify-center text-tx-secondary dark:text-tx-muted hover:bg-[#f1f5f9] dark:hover:bg-[#1e2433] transition-colors">
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent" />
          </button>

          <button aria-label="User menu" className="ui-focus h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[12px] font-bold text-white transition-transform duration-200 hover:scale-[1.03]">
            JD
          </button>
        </div>
      </header>

      {showUpload ? <UploadModal onClose={() => setShowUpload(false)} /> : null}
    </>
  )
}
