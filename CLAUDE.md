# CLAUDE.md — Hearth (family finance app)

SvelteKit 3 + Svelte 5 (runes) + TypeScript + Tailwind CSS 4. Node adapter, shipped as a container.
See README.md for the product overview, importers, configuration and deploy.

## Commands

- `npm run dev` — dev server
- `npm run check` — svelte-check / types
- `npm run lint` — prettier + eslint
- `npm run test:unit -- --run` — vitest (server + browser component projects)
- `npm run test:e2e` — playwright (builds and previews the app)
- `npm run build` — production build to `build/` (`node build`)
- `make help` — Makefile shortcuts at the repo root: `run` (db + dev server), `test`, `unit`, `e2e`, `ci` (lint+check+test+build), `db`, `db-reset`, `image`, `lint`, `check`, `clean`
- `podman build -t hearth .` (or docker) — container image; `podman compose -f compose.prod.yaml up -d` — prod-style stack

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$props`); no legacy `export let` / stores for local state.
- Import shared code via the `#lib/...` package import (SvelteKit 3 removed `$lib`).
- **Money is integer cents**, formatted only at the edge with `#lib/format/` (`formatMoney` etc.). Never floats.
- **European formats everywhere** (UI language stays English): dates `dd/mm/yyyy`, money `1.234,56 €`, percent `12,5 %`. `src/lib/format/` (`date.ts`, `money.ts`, `number.ts`) is the single source of truth: never call `Intl`/`toLocale*` or print a raw ISO date in a template. Month-only labels are English (`Oct 2026`), day axis labels `dd/mm`. Dates travel as ISO `YYYY-MM-DD` (URLs, forms, DB); `parseDate` (ISO or dd/mm/yyyy) and `parseMoney` (`40,50`, `40.5`, `1.234,56`) are the shared tolerant parsers used by server validation. Use `DateInput.svelte` for every date field (never `type=date`; it keeps a hidden ISO input, and without JS the visible field posts dd/mm/yyyy). Tests compare Intl output through `normalizeSpaces` (NBSP/narrow NBSP), never by loosening matchers.
- Server-only code in `src/lib/server/`. Secrets via `$env/dynamic/private`; never commit `.env`.
- Tests next to code: `*.spec.ts` (unit), `*.svelte.spec.ts` (component, vitest browser project; `DateInput` has one), `*.e2e.ts` (playwright).
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

**Colours and themes:** never hard-code a colour; every token needs both a light and a dark value (`--t-*` in `layout.css`, see DESIGN.md "Dark mode"), and category colours are drawn through `chartColor` / `.cat-dot`.

## CI/CD and release

- `.github/workflows/docker.yml` is the entry pipeline (push to `main`, `v*` tags, pull requests): job `test` calls `ci.yml` (reusable, also manually runnable), then job `image` builds the image, smoke-tests it against a MySQL container (waits for `/` = 200, tables exist, container healthy) and only on push to `main`/`v*` logs in and pushes to GHCR (`ghcr.io/<owner>/<repo>`, tags branch/latest/semver/sha). PRs never push.
- `.github/workflows/ci.yml`: MySQL 8.4 service container; `DATABASE_URL` and `TEST_DATABASE_ADMIN_URL` are exported so DB integration tests and e2e really run. Steps: lint, check, migration drift check (`drizzle-kit generate` must leave `/drizzle` unchanged), unit tests (server + browser projects; the client project holds the `DateInput` component spec), build, Playwright e2e.
- Workflows cannot be run locally; the image build and the prod stack were verified with podman instead.
- Image: multi-stage `Dockerfile`, runs as `node`, `HEALTHCHECK` via node fetch, build passes a placeholder `DATABASE_URL` because Kit 3 validates env at build time (not baked into the output). `compose.prod.yaml` = app (`HEARTH_IMAGE`) + MySQL 8.4 with named volume, healthchecks, only the app port published; config in `.env` (see `.env.example`). Tables are created by the app's `init` hook on first start; no manual migration step.
- Deploy: set `HEARTH_IMAGE`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` in `.env`, then `podman compose -f compose.prod.yaml up -d` (or docker). After editing `schema.ts` always run `npm run db:generate` and commit, or CI fails.

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

- Category icons: `categories.icon` stores a key of the curated registry in `src/lib/icons/registry.ts` (hand-written Lucide-style inline SVG, no icon dependency). `CategoryIcon.svelte` draws it in the category colour (`.cat-ink`/`.cat-badge`, lifted in dark mode like `.cat-dot`); decorative (aria-hidden) unless given a `label`. The admin picker (`IconPicker.svelte`) is validated server-side against the registry. Adding an icon = one entry in `ICONS` (+ `DEFAULT_ICON_BY_SLUG` for a seeded slug). The utilities category is named "Supplies" (slug `utilities`); migration `0002` renames the old "Suministros" default only if still unedited.

- Per-row category override: `admin/overrides.ts` (`changeCategory` reuses `assignCategory`; `clearOverride` hands the row back to rules), shared form actions in `admin/override-actions.ts` re-exported as `actions` by `/dashboard/transactions` and `/dashboard/category/[slug]`; `RowCategoryEditor.svelte` posts to the current URL + `&/name` so the query string survives (a bare `?/name` would drop it). `category_source='manual'` rows are never touched by imports, rules or `recategorizeAll` (integration-tested).

- Manual/recurring: `src/lib/server/manual/` (`entries.ts` one-offs, `recurring.ts` templates + idempotent `materialiseRecurring`, `schedule.ts` pure date maths). Manual rows are `statements` with `importer_id='manual'` (hash = random uuid, or sha256 of `recurring:<id>:<date>`), `balance_cents` NULL, linked to the first account via a single `manual` import batch (hidden from the Imports list). `recurring_entries.last_generated` makes deletes/edits/pauses safe. Materialised on server start (hooks.server.ts) and via `ensureMaterialised()` (once a day) in `dashboardContext` and the landing loader. `latestBalance` adds manual rows with `affects_balance` dated after the bank row; `dataRange` anchors at the newest non-future row of any kind. UI: `/admin/manual`.

- AI categorisation: `src/lib/server/ai/` (`config.ts` env -> `AiConfig`, set once in `hooks.server.ts` via `configureAi`; `client.ts` fetch + AbortController timeout, OpenAI chat-completions shape; `prompt.ts` prompt building, privacy sanitising and a never-throwing reply parser; `categorize-ai.ts` grouping, batching, thresholds, persistence; `status.ts` last-run memory + connection test). Disabled when `AI_BASE_URL` is unset. `category_source` is `manual > rule > ai > NULL`: AI writes only rows that are still uncategorised (conditional UPDATE), rules replace `ai` rows when they match, `recategorizeAll` never resets unmatched `ai` rows, and Accept/Change turn `ai` into `manual` (`ai_confidence`/`ai_model` cleared). Runs after `importFile` commits (new rows only, max 200 rows / 60 s, failures never fail the import; result in `ImportSummary.ai`) and from the review page. Only cleaned merchant text + direction + whole-euro amount are sent; never put digits, IBANs, dates or names into the prompt. Tests use mocked `fetch`; e2e uses `e2e/ai-stub.mjs` (port 4199) and a second AI-less preview on 4174. Never point tests at the real service.
- DB pool: `getDb()` keeps its handle on `globalThis` (symbol `hearth.db.handle`) outside production so Vite HMR reloads reuse one pool instead of leaking ~10 connections per reload.

## Gotchas

- `engine-strict=true`; Node 24 (see `.nvmrc`).
- Playwright browsers are needed for component and e2e tests (`npx playwright install --with-deps chromium`).
