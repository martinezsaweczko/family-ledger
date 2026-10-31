# Feature: family-finance-dashboard

## Objective

LAN-only app for David & Joanna: import bank statements (Deutsche Bank .xls first, pluggable for more),
store raw rows in MySQL without double counting, categorise, and analyse income/expenses visually.

## Constraints / decisions

- No auth (LAN only). English UI. Design: Clear Slate (DESIGN.md).
- Stack: SvelteKit 3, Drizzle ORM + mysql2, drizzle-kit migrations auto-applied on server start, Apache ECharts.
- Money = integer cents. Raw rows keep original payload (`raw_json`) immutable.
- Dedup key = sha256(account|booking_date|value_date|concept|amount|balance_after); upsert, re-import never doubles.
- Importers are plugins in a registry (`detect` + `parse`), admin upload auto-detects.
- Bank files are never committed (`/samples`, `*.xls*` gitignored). Tests use synthetic fixtures.
- Sample format (DB Spain "Movimientos"): header rows 1-6, table header row 8 (`date,value_date,concept,...,amount,balance`),
  dates dd/mm/yyyy strings, amounts numbers; incomes are `TRF.EX ... DE <NAME>`.
- Single joint account audited; contributions = salary transfers from David and Joanna (person attribution on income rows).
- Delivery: ask-on-risk; push/PR/merge are the user's decisions. Engram mirror unavailable in this runtime: PENDING.

## Tasks

- [x] T1 DB layer: drizzle schema (accounts, import_batches, statements, categories, category_rules, people), migrations, auto-migrate on startup, seed
- [x] T2 Importer framework + Deutsche Bank importer + dedup upsert + tests (synthetic fixture)
- [x] T3 Categorizer (rules engine, seed categories/rules, person attribution for salary transfers) + tests
- [x] T4 Admin: upload/import history, categories & rules CRUD, uncategorised review/manual override
- [x] T5 Analytics queries (period/granularity/category/person filters) + tests
- [x] T6 Dashboard UI (ECharts): KPIs, income vs expenses, categories, trends, contributions, drill-down, recurring
- [x] T7 Attractive landing page
- [x] T8 CI (MySQL service), Docker/compose release with auto-migrate, docs/CLAUDE.md
- [x] T9 Dark mode (System/Light/Dark)

## Progress / evidence

- T1 DB layer (delegated writer; commit e8d3bac): Drizzle MySQL schema + generated migration in /drizzle, `init` hook in
  src/hooks.server.ts waits for MySQL (retry) then migrates and seeds idempotently; migrations resolved from `process.cwd()/drizzle`
  (override `MIGRATIONS_DIR`), Dockerfile copies `./drizzle`. Kit 3 has no `$env/dynamic/private`: env declared in src/env.ts
  (`defineEnvVars`) and read from `$app/env/private`. xlsx installed from the SheetJS CDN tarball (npm `xlsx` 0.18.5 is stale/vulnerable).
  Evidence: migrate/seed idempotency integration test passes against local MySQL; built server started, init hook seeded DB, HTTP 200.
- T2 Importer framework + Deutsche Bank importer (delegated writer; commit cff28c8): RED observed (missing modules),
  then GREEN for parser/dedup unit tests (synthetic fixture, fake IBAN) and import-service integration tests (same file twice => 0 inserted,
  overlap => only new rows, identical same-day rows distinct, manual categories preserved).

- T3 Categorizer (delegated writer; commit d77d3dc): RED observed (missing modules), GREEN for pure
  rule-engine tests (contains/regex/priority/direction/inactive, seed-rule sanity) and DB integration (rules applied on import to new
  uncategorised rows only; manual category survives recategorizeAll and re-import). ANUL.EFECTIVO (inbound) maps to cash-withdrawals as a
  reversal. Real-sample smoke (counts only): 164 rows parsed, 163 inserted (1 exact duplicate line inside the file collapsed), second
  import inserted 0 / updated 0 / unchanged 164, 132 uncategorised of 163.

- T5 Analytics queries (delegated writer; commit 86682ee): src/lib/server/analytics (summary w/ previous-period delta, timeSeries zero-fill,
  categoryBreakdown, categoryTrend top-N + Other, contributions, topMerchants, recurring, transactions, dataRange). Outputs in cents, spend positive,
  transfer/ignore excluded unless includeTransfers. Latest balance = newest date, lowest id of that day (bank lists a day newest-first).
  Tests: pure bucket/recurring unit tests + MySQL integration with a seeded dataset (zero-fill, transfer exclusion, person split, delta, recurring,
  normalisation). Committed before T4 because it only shares importers/merchant.ts.
- T4 Admin (delegated writer; commit 62f89b9): /admin Imports, Review, Categories, Rules; logic in src/lib/server/admin/*.ts; shared cleanMerchant
  (importers/merchant.ts); Pager/ColorPicker components; BODY_SIZE_LIMIT=25M in Dockerfile. Evidence: unit/integration specs (merchant cleaning,
  rule creation + re-apply counts, category archive keeps statements) and Playwright e2e on a throwaway hearth_e2e DB (synthetic xls upload,
  re-upload => 0 inserted, review assign + rule). Route: delegated; trigger: 2+ non-trivial files.
  Checks: lint, svelte-check, 74 server tests, build, 4 e2e all pass. Visual check via screenshots (desktop imports, mobile review).

- T6 Dashboard (delegated writer; commit fedbfc7): /dashboard (filter bar in URL, 5 KPIs with delta arrow+text, income vs expenses, category donut+list,
  stacked category trend, contributions, top merchants, recurring list, balance line), /dashboard/category/[slug], /dashboard/transactions, global nav in root layout.
  Chart 7 choice: balance-over-time line instead of a month x category heatmap, because the stacked category trend already shows category x time,
  while the closing balance is the only view of liquidity/runway. Ranges are anchored at the latest statement date (data is imported by hand).
  Pure logic (presets, URL parsing, insight text, balance buckets) unit tested; 98 server tests pass. Route: delegated; trigger: 2+ non-trivial files.
  Evidence: lint, svelte-check, build, 12 Playwright e2e pass (synthetic seed e2e/synthetic.ts); desktop+mobile screenshots reviewed, horizontal overflow
  from the sr-only tables fixed; web-design-guidelines rules fetched and applied (heading order, duplicate #content id, theme-color, search input attrs).
- T7 Landing (delegated writer; commit 3ab21ab): hero with live balance/month numbers and an SVG income-vs-expenses chart from real monthly data
  (labelled sample illustration when empty), four feature rows with inline SVG icons, CTA band, footer. e2e covers empty and populated states.

- T8 CI/release/docs (delegated writer; commits 164bcf4 + admin layout cleanup 9cd1bd8): ci.yml (reusable, MySQL 8.4 service, drift check, unit, build, e2e),
  docker.yml (tests -> image build + smoke vs MySQL -> GHCR push only on main/v* push), Dockerfile (labels, HEALTHCHECK, placeholder DATABASE_URL at build
  because Kit 3 validates env at build), compose.prod.yaml, .env.example, README. Route: delegated; trigger: 2+ non-trivial files.
  Evidence: podman build OK; prod stack run under a throwaway project on port 3999: GET / 200, GET /dashboard 200, 7 app tables + __drizzle_migrations
  created, runs as user node; everything torn down (dev db untouched). lint, check, 98 server tests, build, 12 e2e pass; drizzle-kit generate => no changes.
  NOT verified: the GitHub workflows themselves (YAML parses only), the Docker HEALTHCHECK status (podman builds OCI format and ignores it), GHCR push.

- T9 Dark mode (delegated writer; commit fdde296): runtime CSS-variable tokens (light/dark/system) in layout.css, pre-paint script in app.html, ThemeToggle in nav,
  Chart.svelte re-themes live, `chartColor` (OKLCH) for category colours, `.cat-dot` for dots. Route: delegated; trigger: 2+ non-trivial files.
  Evidence: RED (missing modules) then GREEN for theme/color/tokens specs (contrast pairs both themes; light attention-500/600 failed AA/3:1 and were darkened);
  lint, svelte-check, 167 server tests, build, 16 Playwright e2e pass; 2 screenshot rounds (8 pages x 2 themes x 2 widths); web-design-guidelines rules fetched (summary only), no findings.

## Remaining / future ideas

- Per-category budgets with progress and alerts
- Savings goals
- CSV and other bank importers
- Backups / data export (scheduled mysqldump, CSV export)
- Anomaly alerts (unusual amounts, new recurring charges)
- Client component tests (the browser vitest project currently has none)

## Next step

Push the branch and open a PR (user decision); set HEARTH_IMAGE to the real GHCR path on the server.
