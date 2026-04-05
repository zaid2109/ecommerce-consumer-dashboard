# EcoDash — E-commerce Analytics Dashboard

## Overview

EcoDash is a high-performance Next.js 14 analytics dashboard built for large synthetic commerce datasets. It provides executive KPIs, multi-page analytics (overview, analytics, customers, products, payments, returns), and operational tooling (filters, CSV export, dynamic chart rendering) on top of a 100,000-order pre-aggregated data model.

## Features

- 6 dashboard experiences: Overview, Analytics, Customers, Products, Payments, Returns
- 100k deterministic synthetic orders with rich pre-aggregations
- Worker-assisted loading with progress UI
- Dynamic chart loading (`ssr: false`) with skeleton fallbacks
- Virtualized large data tables (React Virtuoso)
- CSV export across table surfaces
- Dark mode + responsive layout shell
- Typed insights and recommendation systems

## Tech stack

| Library | Version | Purpose |
|---|---:|---|
| Next.js | 14.2.35 | App framework and routing |
| React | 18.3.1 | UI runtime |
| TypeScript | 5.x | Static typing |
| Tailwind CSS | 4.x | Styling system |
| Zustand | 4.x | Global filter state |
| Recharts | 2.12.7 | Chart visualizations |
| @tanstack/react-table | 8.x | Column model + table logic |
| react-virtuoso | 4.x | Virtualized lists/tables |
| date-fns | 3.x | Date/time formatting |
| html2canvas | 1.4.x | Chart PNG downloads |

## Getting started

```bash
git clone <your-repo-url>
cd ecommerce-dashboard
npm install
npm run dev
```

## Project structure

```text
app/
  dashboard/
    page.tsx                 # Overview dashboard
    analytics/page.tsx       # Analytics dashboard
    customers/page.tsx       # Customer intelligence dashboard
    products/page.tsx        # Product performance dashboard
    payments/page.tsx        # Payment operations dashboard
    returns/page.tsx         # Returns/refunds dashboard
components/
  cards/                     # KPI, insight, and action cards
  charts/                    # Reusable chart primitives
  layout/                    # Sidebar/Header/Shell/FilterBar
  tables/                    # Virtual and paginated table components
  ui/                        # Tooltips, skeletons, basic UI blocks
hooks/
  useChartData.ts            # Core dashboard data hooks
  useDashboardData.ts        # Analytics/customers computations
  useCommerceData.ts         # Products/payments/returns computations
  useDebounce.ts             # Shared debounce hook
lib/
  data-generator.ts          # Deterministic 100k record seed data
  data-store.ts              # Runtime data readiness + worker wiring
  insights.ts                # Typed insight generation helpers
  recommendations.ts         # Typed action recommendation engine
  export.ts                  # CSV export utility
  downloadChart.ts           # PNG download helper
public/workers/
  dataWorker.js              # Web Worker data bootstrap/progress
```

## Data layer

The data layer generates 100,000 deterministic synthetic orders and computes pre-aggregations for high-frequency dashboard reads (daily revenue, category trends, segment distribution, payment breakdowns, return rates, rating distributions, and country-level revenue). Hooks consume these structures with memoized filtering to avoid expensive recomputation on each render.

## Performance notes

- **Web Worker loading**: startup data generation/progress is handled outside the main UI thread
- **Virtualization**: large tables use `TableVirtuoso` to keep DOM size stable
- **Memoization**: all major hook computations are wrapped in `useMemo` with explicit filter dependencies
- **Dynamic chart imports**: chart bundles load on demand with skeleton fallbacks
- **Controlled chart animation**: one-time animation pattern avoids repeated re-animation on filter changes

## Screenshots

[Add screenshot here]
