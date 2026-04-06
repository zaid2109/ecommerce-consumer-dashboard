'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BarChart3, Users, ShoppingCart,
  Package, RotateCcw, CreditCard, Settings,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Customers', href: '/dashboard/customers', icon: Users },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
  { label: 'Products', href: '/dashboard/products', icon: Package },
  { label: 'Returns', href: '/dashboard/returns', icon: RotateCcw },
  { label: 'Payments', href: '/dashboard/payments', icon: CreditCard },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex flex-col bg-sb-bg transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 72 : 240 }}
    >
      <div className="flex items-center h-16 px-4 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" opacity="0.7" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.7" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.4" />
          </svg>
        </div>
        {!collapsed && (
          <span className="ml-3 text-[16px] font-semibold text-white whitespace-nowrap">
            EcoDash
          </span>
        )}
      </div>

      {!collapsed && (
        <p className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#4b5563]">
          Pages
        </p>
      )}

      <nav className="flex-1 py-1 overflow-y-auto overflow-x-hidden">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined}>
              <div className={`nav-link ui-focus ${isActive ? 'nav-link-active' : ''}`} aria-current={isActive ? 'page' : undefined}>
                <Icon
                  size={17}
                  className={`shrink-0 ${isActive ? 'text-white' : 'text-sb-icon'}`}
                />
                {!collapsed && <span>{label}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      <button
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        className="ui-focus flex items-center justify-center h-10 mx-2 mb-1 rounded-lg
                   text-sb-icon hover:bg-sb-hover hover:text-white transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span className="ml-2 text-[13px] font-medium">Collapse</span>}
      </button>

      <div className="flex items-center gap-3 px-3 py-3 border-t border-sb-border shrink-0">
        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center
                     bg-gradient-to-br from-indigo-500 to-purple-600
                     text-white text-[11px] font-bold">
          JD
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[13px] font-medium text-white truncate leading-tight">
              John Doe
            </p>
            <p className="text-[11px] text-sb-icon truncate">admin@nellavio.com</p>
          </div>
        )}
      </div>
    </aside>
  )
}
