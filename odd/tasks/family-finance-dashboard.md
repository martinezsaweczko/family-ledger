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
- [ ] T1 DB layer: drizzle schema (accounts, import_batches, statements, categories, category_rules, people), migrations, auto-migrate on startup, seed
- [ ] T2 Importer framework + Deutsche Bank importer + dedup upsert + tests (synthetic fixture)
- [ ] T3 Categorizer (rules engine, seed categories/rules, person attribution for salary transfers) + tests
- [ ] T4 Admin: upload/import history, categories & rules CRUD, uncategorised review/manual override
- [ ] T5 Analytics queries (period/granularity/category/person filters) + tests
- [ ] T6 Dashboard UI (ECharts): KPIs, income vs expenses, categories, trends, contributions, drill-down, recurring
- [ ] T7 Attractive landing page
- [ ] T8 CI (MySQL service), Docker/compose release with auto-migrate, docs/CLAUDE.md

## Progress / evidence
(none yet)

## Next step
T1
