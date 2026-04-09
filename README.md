# EcoDash

EcoDash is a Next.js 14 e-commerce analytics dashboard with secure auth, multi-tenant APIs, dataset ingestion, and production-oriented hardening.

It supports both demo/static data and uploaded datasets processed server-side.

## Highlights

- Next.js App Router dashboard for orders, customers, products, payments, returns, and settings
- JWT + refresh-session auth with CSRF protection on state-changing routes
- Workspace-aware RBAC and tenant isolation in API routes
- File upload parsing (`csv`, `tsv`, `xlsx`, `json`) with limits, type checks, and AV hook support (`.xls` is intentionally rejected)
- Idempotent dataset creation + ingestion jobs
- Connector framework (Shopify, Stripe, GA4, S3) with encrypted connector configs
- Saved views (private/team), share-token links, and pinning support
- Async alert/event and export job APIs with audit logging
- P2 enterprise surfaces: billing/subscriptions, GDPR/DPA/retention/subprocessors, SAML/OIDC config, ops playbooks/SLO/backup drills, sales ROI + packs
- CI release gate with type-check, lint, build, and integration checks

## Tech stack

- Next.js 14, React 18, TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- BullMQ + Redis (queue-backed workers)
- Recharts + TanStack Table + React Virtuoso
- Zustand for client state

## Quick start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env.local` and set values:

```bash
cp .env.example .env.local
```

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `CONNECTOR_ENCRYPTION_KEY`

Usually required for full feature set:

- `ANTHROPIC_API_KEY` (AI dataset analysis)
- `REDIS_URL` (queue workers)

Optional:

- `ENABLE_AV_SCAN` + `AV_SCAN_URL`
- `CSP_ALLOW_UNSAFE_INLINE` (compatibility toggle; keep `false`/unset in production)
- OAuth provider credentials (Google/Microsoft)

### 3) Generate demo data

```bash
npm run generate
```

### 4) Run app

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Core scripts

- `npm run dev` — start dev server
- `npm run build` — production build (runs `generate` first)
- `npm run start` — run production build
- `npm run type-check` — TypeScript checks
- `npm run lint` — ESLint
- `npm run generate` — regenerate static demo artifacts
- `npm run check:integration` — API/auth/tenant integration checks
- `npm run test:unit` — unit tests
- `npm run test:unit:coverage` — unit tests with coverage thresholds
- `npm run check:bundle-budget` — fail build if JS bundle exceeds configured budget
- `npm run worker:ingestion` — ingestion worker
- `npm run worker:connector-sync` — connector sync worker

## Security model (high level)

- Protected APIs require valid bearer JWT (except explicit local test mode).
- CSRF enforced when session cookies are present.
- No trust of user/workspace identity headers.
- Sensitive values (invite tokens, magic link tokens, decrypted connector secrets) are not returned to clients.
- CSP and secure headers are set centrally in `next.config.js`.

## Data flow

### Demo mode

`npm run generate` writes `public/data/orders.json` and `public/data/aggregated.json` for fast dashboard rendering.

### Uploaded dataset mode

1. Client uploads file to `/api/parse-file`
2. Server validates/parses and stores raw artifact
3. Client creates dataset via `/api/datasets` (idempotent)
4. Ingestion worker transforms and writes processed artifact
5. UI reads processed data from `/api/datasets/[id]/data`

## Validation checklist

Run before merging:

```bash
npm run type-check
npm run lint
npm run generate
npm run build
npm run check:integration
npm run test:unit:coverage
npm run check:bundle-budget
```

## CI/CD release gates

- `.github/workflows/ci.yml` enforces type-check, lint, integration, build, unit coverage thresholds, and bundle budget.
- `.github/workflows/security.yml` enforces dependency and container vulnerability scans.
- `.github/workflows/canary-rollback.yml` provides manual canary or rollback trigger via `DEPLOY_WEBHOOK_URL` secret.

## Project note

This repository is private/internal by default.
