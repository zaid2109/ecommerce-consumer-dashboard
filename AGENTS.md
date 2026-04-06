# Agent Instructions for EcoDash

## Before writing any code
1. Read `CLAUDE.md` for project context and rules
2. Check `lib/types.ts` for all shared interfaces
3. Run `npx tsc --noEmit` before and after your changes

## Styling rules
- This is a DARK-ONLY dashboard
- Every card: `className="sc"` (defined in globals.css)
- Every table: `className="st w-full"` (defined in globals.css)
- Do not use Tailwind `bg-white`, `bg-gray-*`, or `rounded-xl` directly
- Chart colors: green=#4ade80, blue=#60a5fa, purple=#a78bfa, red=#f87171

## Chart rules
- Always use `next/dynamic` with `ssr: false` for any Recharts component
- Always add `isAnimationActive={!hasAnimated.current}` to prevent re-animation
- Always wrap ResponsiveContainer in `<div role="img" aria-label="...">`
- Always use `useChartTheme()` hook for grid and axis colors

## Do not use
- `@base-ui/react` (removed — use shadcn/radix instead)
- `xlsx` package (removed — use exceljs instead)
- Static imports of chart components at page level
