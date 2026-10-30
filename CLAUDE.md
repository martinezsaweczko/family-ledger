# CLAUDE.md — Hearth (family finance app)

SvelteKit 3 + Svelte 5 (runes) + TypeScript + Tailwind CSS 4. Node adapter, shipped as a container.
Product scope is still being defined; keep the skeleton small until requirements arrive.

## Commands

- `npm run dev` — dev server
- `npm run check` — svelte-check / types
- `npm run lint` — prettier + eslint
- `npm run test:unit -- --run` — vitest (server + browser component projects)
- `npm run test:e2e` — playwright (builds and previews the app)
- `npm run build` — production build to `build/` (`node build`)
- `docker build -t hearth .` — container image

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$props`); no legacy `export let` / stores for local state.
- Import shared code via the `#lib/...` package import (SvelteKit 3 removed `$lib`).
- **Money is integer cents**, formatted only at the edge with `#lib/format/money.ts`. Never floats.
- Server-only code in `src/lib/server/`. Secrets via `$env/dynamic/private`; never commit `.env`.
- Tests next to code: `*.spec.ts` (unit), `*.svelte.spec.ts` (component), `*.e2e.ts` (playwright).
- Conventional Commits. Small, tested changes.

## Design

Follow [DESIGN.md](DESIGN.md) ("Clear Slate"): tokens in `src/routes/layout.css`, Inter,
tabular numbers for amounts, calm palette (primary teal / attention amber / highlight indigo on cool slate).

## Skills to use

Installed in `.claude/skills/`. `DESIGN.md` is the source of truth: skills must follow its tokens, never invent a palette.

- **design-taste-frontend** (Taste) — art direction and anti-"AI slop" polish for pages and app screens.
- **web-design-guidelines** — audit UI for accessibility/UX before finishing a UI change (`file:line` findings).
- **screenshot-to-code** (stands in for ImageToCode) — turn mockups/screenshots into components. Output must be **Svelte 5 runes + Tailwind 4** using the tokens in `src/routes/layout.css`, not React.
- Awesome-design-md is not a skill: it is a collection of brand `DESIGN.md` files (VoltAgent/awesome-design-md). Borrow patterns from it into `DESIGN.md` when needed.

## Changing the design

The design lives in two places only: `DESIGN.md` (rules) and the `@theme` block in `src/routes/layout.css` (tokens). To restyle, edit both, keep token names, and components follow. Never hardcode colours in components.

## CI/CD

- `.github/workflows/ci.yml`: lint, check, unit tests, build, e2e on every PR/push.
- `.github/workflows/docker.yml`: on `main` and `v*` tags, builds and pushes image to GHCR.

## Backend

- DB: Drizzle + mysql2 (`src/lib/server/db`). `npm run db:generate` after editing `schema.ts`; migrations in `/drizzle` are applied (then seeded) automatically by the `init` hook in `src/hooks.server.ts`. Env: `DATABASE_URL` (declared in `src/env.ts`, Kit 3 has no `$env/dynamic/private`).
- Importers are plugins: one file in `src/lib/server/importers/` + one line in `registry.ts`. `importFile` dedups by `dedup_hash`; manual categories are never overwritten.
- Local DB: `podman compose up -d db`. DB integration tests use throwaway `hearth_test_*` databases (admin URL `TEST_DATABASE_ADMIN_URL`, default root@127.0.0.1) and skip when MySQL is unreachable.
- Admin (`/admin`, no auth, LAN only): Imports, Review, Categories, Rules. Server logic is thin and testable in `src/lib/server/admin/*.ts`; routes only parse forms and call it. Uploads need `BODY_SIZE_LIMIT` (Dockerfile sets 25M; adapter-node defaults to 512K).
- Analytics: `src/lib/server/analytics/*.ts` (SQL aggregation, one shared filter). Outputs are cents; expenses are reported as POSITIVE spend; `transfer`/`ignore` categories are excluded unless `includeTransfers`. Merchant names come from `importers/merchant.ts` (`cleanMerchant`), shared by rule suggestions, top merchants and recurring detection.
- e2e: `npx playwright test` builds and previews against a throwaway `hearth_e2e` MySQL database (created/dropped by `e2e/db.mjs`, admin URL `TEST_DATABASE_ADMIN_URL`); it never touches the dev `hearth` DB.
- Bank files are never committed or put in tests/fixtures; build synthetic ones (see `importers/test-fixtures.ts`).
- Dashboard (`/dashboard`, `/dashboard/category/[slug]`, `/dashboard/transactions`): filter state lives in the URL (`range` preset | `from`/`to`, `g`, `cat`, `transfers`, plus `q`/`sort`/`page` on tables); parsing, presets and insight sentences are pure code in `src/lib/dashboard/` (unit tested). Ranges are anchored at the latest statement date, not today. Loaders live in each `+page.server.ts` and share `dashboard/context.server.ts`; they call the analytics functions in parallel and return a `failed` message instead of throwing.
- Charts: Apache ECharts via `components/Chart.svelte` (client-only init, SVG renderer, ResizeObserver, reduced-motion aware, sr-only data table). Colours come from CSS tokens (`@theme static` in layout.css, read by `dashboard/chart-theme.ts`); option builders are in `dashboard/charts.ts`. Register new ECharts modules in `dashboard/echarts.ts`.
- e2e: `e2e/synthetic.ts` seeds a fake household (fake IBAN and merchants) into `hearth_e2e`; Playwright runs with one worker because specs share that database. `node e2e/seed-cli.ts <db-url> [--empty]` seeds any throwaway DB for screenshots.

## Gotchas

- `engine-strict=true`; Node 24 (see `.nvmrc`).
- Playwright browsers are needed for component and e2e tests (`npx playwright install --with-deps chromium`).
