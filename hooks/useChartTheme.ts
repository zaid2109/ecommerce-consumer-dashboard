'use client'

import { useTheme } from 'next-themes'

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  return {
    gridColor: isDark ? '#1e2433' : '#e2e8f0',
    textColor: isDark ? '#9ca3af' : '#64748b',
  }
}
