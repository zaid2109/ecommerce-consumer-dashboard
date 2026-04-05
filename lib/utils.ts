import { formatDistanceToNow } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const CHART_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'] as const

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-US')

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number): string {
  return currencyFormatter.format(n)
}

export function formatNumber(n: number): string {
  return numberFormatter.format(n)
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

export function relativeTime(d: Date): string {
  return formatDistanceToNow(d, { addSuffix: true })
}

export function getColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const int = Number.parseInt(normalized, 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

export function interpolateColor(value: number, min: number, max: number, from: string, to: string): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bch = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r}, ${g}, ${bch})`
}

export function getFlagEmoji(countryName: string): string {
  const map: Record<string, string> = {
    'United States': '🇺🇸',
    France: '🇫🇷',
    'United Kingdom': '🇬🇧',
    Germany: '🇩🇪',
    India: '🇮🇳',
    Australia: '🇦🇺',
    Canada: '🇨🇦',
    Japan: '🇯🇵',
    Brazil: '🇧🇷',
    Italy: '🇮🇹',
    Spain: '🇪🇸',
    Netherlands: '🇳🇱',
    Norway: '🇳🇴',
    Poland: '🇵🇱',
    Sweden: '🇸🇪',
    Mexico: '🇲🇽',
    Singapore: '🇸🇬',
    UAE: '🇦🇪',
  }
  return map[countryName] ?? '🌐'
}
