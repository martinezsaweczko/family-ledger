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
- Delivery: ask-on-risk; push/PR/merge are the user's decisions. Engram mirror unavailable in this runtime: PENDING.

## Tasks

- [x] T1 DB layer: drizzle schema (accounts, import_batches, statements, categories, category_rules, people), migrations, auto-migrate on startup, seed
- [x] T2 Importer framework + Deutsche Bank importer + dedup upsert + tests (synthetic fixture)
- [x] T3 Categorizer (rules engine, seed categories/rules, person attribution for salary transfers) + tests
- [ ] T4 Admin: upload/import history, categories & rules CRUD, uncategorised review/manual override
- [ ] T5 Analytics queries (period/granularity/category/person filters) + tests
- [ ] T6 Dashboard UI (ECharts): KPIs, income vs expenses, categories, trends, contributions, drill-down, recurring
- [ ] T7 Attractive landing page
- [ ] T8 CI (MySQL service), Docker/compose release with auto-migrate, docs/CLAUDE.md

## Progress / evidence

- T1 DB layer (delegated writer; commit e8d3bac): Drizzle MySQL schema + generated migration in /drizzle, `init` hook in
  src/hooks.server.ts waits for MySQL (retry) then migrates and seeds idempotently; migrations resolved from `process.cwd()/drizzle`
  (override `MIGRATIONS_DIR`), Dockerfile copies `./drizzle`. Kit 3 has no `$env/dynamic/private`: env declared in src/env.ts
  (`defineEnvVars`) and read from `$app/env/private`. xlsx installed from the SheetJS CDN tarball (npm `xlsx` 0.18.5 is stale/vulnerable).
  Evidence: migrate/seed idempotency integration test passes against local MySQL; built server started, init hook seeded DB, HTTP 200.
- T2 Importer framework + Deutsche Bank importer (delegated writer; commit cff28c8): RED observed (missing modules),
  then GREEN for parser/dedup unit tests (synthetic fixture, fake IBAN) and import-service integration tests (same file twice => 0 inserted,
  overlap => only new rows, identical same-day rows distinct, manual categories preserved).

- T3 Categorizer (delegated writer; commit recorded in git log as `feat(categorizer)`): RED observed (missing modules), GREEN for pure
  rule-engine tests (contains/regex/priority/direction/inactive, seed-rule sanity) and DB integration (rules applied on import to new
  uncategorised rows only; manual category survives recategorizeAll and re-import). ANUL.EFECTIVO (inbound) maps to cash-withdrawals as a
  reversal. Real-sample smoke (counts only): 164 rows parsed, 163 inserted (1 exact duplicate line inside the file collapsed), second
  import inserted 0 / updated 0 / unchanged 164, 132 uncategorised of 163.

## Next step

T4 (admin UI: upload, history, categories/rules CRUD, uncategorised review)
