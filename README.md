# EcoDash - E-commerce Analytics Dashboard

EcoDash is a production-hardened analytics dashboard built with Next.js 14 for large e-commerce datasets.  
It includes multi-page insights, upload parsing, pre-aggregated metrics, and chart/table-heavy UI with accessibility and performance optimizations.

## What you get

- Dashboard modules for overview, analytics, orders, customers, products, payments, returns, and settings
- Synthetic data pipeline (100,000 orders) with static pre-aggregation generation
- Upload parser API for CSV/XLS/XLSX ingestion (`exceljs`-based)
- Virtualized tables and interactive chart components
- Error boundaries and loading states for dashboard routes
- Deployment-ready defaults (CI workflow, Vercel config, security headers)

## Tech stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives
- Recharts + TanStack Table + React Virtuoso
- Zustand for client state
- date-fns + faker + exceljs

## Quick start

### 1) Install

```bash
npm install
```

### 2) Configure environment

```bash
cp .env.example .env.local
```

Set required values in `.env.local`:

- `ANTHROPIC_API_KEY` (required for dataset analysis API paths that use Anthropic)

### 3) Generate static data

```bash
npm run generate
```

### 4) Run locally

```bash
npm run dev
```

Open: `http://localhost:3000/dashboard`

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build (runs `prebuild` -> `generate`)
- `npm run start` - start production server
- `npm run lint` - ESLint checks
- `npm run type-check` - TypeScript validation (`tsc --noEmit`)
- `npm run generate` - generate `public/data/aggregated.json`

## Data pipeline

The app uses a generated static aggregate file for fast dashboard loads:

1. `lib/scripts/generate-static-data.ts` builds aggregate output
2. Output is written to `public/data/aggregated.json`
3. `lib/data-store.ts` reads and caches this data for the UI

This design keeps heavy calculations out of render-time execution.

## Project structure (high level)

```text
app/
  api/parse-file/route.ts         # Upload parsing endpoint
  dashboard/                      # Dashboard pages + route boundaries
components/
  charts/                         # Recharts visual components
  tables/                         # Virtualized and standard tables
  layout/                         # Sidebar, header, filters, shell
hooks/                            # Data and chart hooks
lib/
  data-generator.ts               # Synthetic dataset generation
  data-store.ts                   # Aggregate loading/filter helpers
  scripts/generate-static-data.ts # Build-time aggregate generator
public/data/                      # Generated static data artifacts
```

## Deployment

### Vercel

- `vercel.json` defines function durations and cache headers for `/data/*`.
- Build command can remain default (`npm run build`), which includes data generation automatically.

### CI

GitHub Actions workflow is included at:

- `.github/workflows/ci.yml`

## Troubleshooting

- If UI appears unstyled in dev:
  1. Stop all dev servers
  2. Delete `.next`
  3. Run `npm run dev` again
  4. Hard refresh browser (`Ctrl+F5`)

- If build fails on missing generated data:
  - Run `npm run generate` once, then retry build

## Validation checklist

Before pushing:

```bash
npm run type-check
npm run lint
npm run generate
npm run build
```

## License

Private/internal project. Add your preferred license if this will be public.
