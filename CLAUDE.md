# EcoDash — AI Agent Context

## Project overview
Next.js 14 App Router e-commerce analytics dashboard.
100k synthetic orders, 6 dashboard pages, AI-powered CSV upload.

## Key commands
- `npm run dev` — start dev server (port 3000)
- `npm run generate` — regenerate synthetic data JSON
- `npm run build` — full production build (runs generate first)
- `npx tsc --noEmit` — type-check only

## Architecture rules
- Data layer: `lib/` — do NOT add React imports here
- Hooks: `hooks/` — all data access goes through these, never direct imports in pages
- Charts: always use `next/dynamic` with `ssr: false` in page files
- Styling: dark-only dashboard — bg is always #0d0f14, cards #141820
- The `.sc` CSS class is the card primitive — use it on every card
- The `.st` CSS class is the table primitive — use it on every table

## Environment
Requires `ANTHROPIC_API_KEY` in `.env.local` for upload feature.
See `.env.example` for all variables.

## Do NOT modify
- `lib/data-generator.ts` — deterministic seed, changes break reproducibility
- `lib/types.ts` — shared type contracts across the whole app
- `public/data/aggregated.json` — auto-generated, do not edit by hand
