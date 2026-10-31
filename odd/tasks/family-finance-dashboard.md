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
- [x] T10 Category icons + Supplies rename, per-transaction override, manual/recurring payments
- [x] T11a European date/number formats + DateInput
- [x] T11b Reuse the MySQL pool across HMR reloads
- [x] T12 AI categorisation (optional, OpenAI-compatible, mocked tests)

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

- T10a Rename + category icons (delegated writer; commit 97dc9c5): "Suministros" -> "Supplies" (slug `utilities` kept); migration 0002 renames only while the
  name is still the old default and backfills icons by slug where NULL; `categories.icon` (migration 0001); curated hand-written Lucide-style registry
  (`src/lib/icons`, no icon dependency), `CategoryIcon`, icons in chips/ranked list/drill-down header/transactions/review/admin list, accessible `IconPicker`
  (radio group, filter, live preview) validated server-side. Route: delegated; trigger: 2+ non-trivial files.
  Evidence: RED (seed had no icon) then GREEN registry spec; DB specs for rename-when-default / preserved-when-edited / backfill / idempotent seed; e2e icons render + picker saves + server rejects bad key.
- T10b Per-transaction category override (commit 79cf3db): `admin/overrides.ts` (`changeCategory` reuses `assignCategory`, `clearOverride`), shared form actions re-exported by
  /dashboard/transactions and /dashboard/category/[slug], `RowCategoryEditor` posting to the current URL (+`&/action`) so the query string survives, edited/manual badges, optional rule.
  Evidence: integration test (import, override, same-file and superset re-import, recategorizeAll: override and counts unchanged) passed on first run since it verifies an existing guarantee (no RED); e2e keeps q/sort/range.
- T10c Manual + recurring (commit 68fb2f7, migration 0003): `statements.note/affects_balance/recurring_id`, `recurring_entries`, `/admin/manual`, `materialiseRecurring` (start + lazy daily),
  balance = latest bank balance + flagged manual rows dated strictly after it, `dataRange` anchored at the newest non-future row of any kind. Route: delegated.
  Evidence: RED (missing module) then GREEN schedule spec (weekly/biweekly/monthly clamp, end date); DB specs for idempotency, pause/resume, edit-future-only, deleted occurrence stays deleted,
  balance rule, analytics inclusion, anchor, validation and "imported rows cannot be edited" were written after the code (RED not observed); e2e add one-off + recurring, badge, balance, immutability.
  Checks (all three): lint, svelte-check, 212 server tests, build, 27 Playwright e2e, drizzle-kit generate => no changes. Visual: 2 screenshot rounds (light/dark x desktop/mobile) on dashboard, transactions, categories, review, manual.
  Fixes found by screenshots: row editor squeezed into the description column (now a full-width row), transactions amount clipped on mobile (date wraps), admin sub-nav wrapped to two lines (scrolls).
  Known: a leaked-connection dev server on the dev `hearth` DB exhausted MySQL max_connections once (raised at runtime to 600); DB spec hooks now have a 60s timeout.

- T11a European formats (delegated writer; commit 768f484): `src/lib/format/` (date, money, number, space) is the single source of truth: dd/mm/yyyy, `1.234,56 €`
  (es-ES + `useGrouping:'always'`), `12,5 %`, chart axis dd/mm, month labels `Oct 2026`; shared `parseDate` (ISO or dd/mm/yyyy) and tolerant `parseMoney` (`40,50`, `40.5`,
  `1.234,56`, rejects garbage) used by server validation and URL filters; `DateInput.svelte` replaces every native date input (mask, strict calendar validation, aria-live error,
  calendar button via hidden type=date + showPicker, hidden ISO input; posts dd/mm/yyyy itself without JS). Route: delegated; trigger: 2+ non-trivial files.
  Evidence: RED (missing modules) for format specs, then GREEN; DateInput component spec (vitest browser, written after the code), e2e formats (typing, 31/02 and 13/13 rejected,
  picker, filter bar, no-JS post); updated money/insights/dashboard/manual specs. Screenshots (landing, dashboard, transactions, review, manual, custom range; light/dark x desktop/mobile),
  4 rounds. Defects fixed: Apply button overlapped by the category dropdown after date fields grew (DateInput width), long euro KPI amounts overflowing 2-column cards at 320px
  (1 column below 400px, wrapping), landing chart last label clipped (`Mar 2026`), landing income/expense/rate row too tight on narrow screens.
- T11b DB pool (commit 27ebbfa): handle cached on `globalThis` (symbol key) outside production; RED observed (new module instance created a second pool), GREEN with vi.resetModules spec.
- T12 AI categorisation (commit 267cee0, migration 0004: `category_source` + 'ai', `ai_confidence`, `ai_model`): `src/lib/server/ai/*`, env AI_BASE_URL/MODEL/API_KEY/TIMEOUT_MS/MIN_CONFIDENCE,
  precedence manual > rule > ai, runs after import commit (new rows, 200 rows / 60 s, never fails the import) and from the review queue; badge, Accept, Change category, admin
  status + Test connection. Tests written after the code (RED not observed): 20 pure + 19 DB-integration specs with mocked fetch, e2e with `e2e/ai-stub.mjs` (port 4199) and an AI-less preview (4174).
  Live smoke (1 call, synthetic text): HTTP 200 in ~2 s, shape `{id, object, created, model, choices[{index, message{role, content}, finish_reason}], usage{prompt_tokens, completion_tokens, total_tokens}}`,
  content parsed to `[{"id":1,"category":"supermarket","confidence":0.95}]`.
  Checks: lint, svelte-check, 285 unit tests (server + client), build, 38 Playwright e2e, drizzle-kit generate => no changes.
  Known: adapter-node 6 only reads `origin` at build time and defaults the protocol to https, so form POSTs to the production `node build` over plain http get 403 (README's ORIGIN advice does not apply);
  verified with `node build`, not fixed here (svelte.config / deploy decision).
- [x] T13 Protocol-agnostic CSRF (commit 19187d8; route: delegated; trigger: 2+ non-trivial files): `kit.csrf.trustedOrigins: ['*']` + `src/lib/server/csrf.ts` (`isSameOriginRequest`,
      Origin vs Host ignoring scheme, form content types, `TRUSTED_ORIGINS`) composed in `handle`; README/CLAUDE.md/.env.example/compose.prod.yaml updated.
      Evidence: RED (missing module) then GREEN 23 specs; real `node build` + curl on /admin/rules?/reapply: matching Origin 200, https Origin same host not 403, evil origin 403, no Origin 403, `null` 403;
      same request on the pre-fix build 403. e2e `e2e/csrf.e2e.ts`. vite preview never failed because it derives the origin from the real Host (http://localhost:4173), unlike adapter-node.

- [x] T14 Rules export/import (commit 1277dab; route: delegated; trigger: 2+ non-trivial files): pure `admin/rules-file.ts` (format `hearth.rules` v1, strict parse, `planImport`, `assignPriorities`) + `admin/rules-io.ts`
      (export, preview, `confirmImport` in ONE transaction re-parsing/re-diffing the payload carried in a hidden field; aborts when more entries are invalid than the preview showed) + `GET /admin/rules/export` + preview/result UI on /admin/rules.
      Deviations: priority alone is not a conflict and an existing rule's priority is never changed (otherwise a second import of the same file would report conflicts, since appended priorities differ); imported priorities may be shared
      among the file's own rules (only a clash with an EXISTING rule forces an append) so a roundtrip reproduces the original ties; unknown person = invalid entry; categories created are only those needed by importable rules.
      Evidence: 10 pure + 8 DB specs (shape without ids/statement data, roundtrip into an empty DB, idempotent re-import, conflict keep/imported, missing category on/off, priority append, abort after a person vanished, tampered payload, recategorised count)
      and 3 e2e (download content, upload -> preview -> confirm -> 0 created on re-import, bad JSON). Tests were written after the code (RED not observed). Screenshots: 2 rounds (preview/result, light+dark, desktop+mobile), defects fixed: duplicated
      "Invalid regular expression:" prefix, invalid list order, import card moved under the two tool cards, "everything already here" message wrong when the file only had invalid entries, result skipped-invalid ignored file-level invalid entries.
      Docs: README "Backing up and sharing rules", CLAUDE.md.
- [x] T15 Uncategorised + source filters (commit 910f060; route: delegated; trigger: 2+ non-trivial files): `AnalyticsFilter.includeUncategorised` (OR with categories) and `source`, URL `uncategorised=1` / `source=` (legacy URLs untouched), Uncategorised option in the
      picker, Source select (explorer only), counter badge, banner "Categorise them" (keeps the CURRENT range so the number matches), Uncategorised breakdown row links to the filtered view, in-place refresh with focus restore (same row control, next row, or list),
      redirect to the last existing page when the last row of a page is fixed, "All caught up" empty state. Finding: uncategorised rows were ALREADY counted in totals (kind NULL, sign decides) and appear as their own breakdown bucket with the dashed icon;
      now pinned by tests (sum of breakdown = summary; categorised + uncategorised = all). Touch targets: Accept, "also create a rule" label and Change category went from 32px to 44px via an `after:` pseudo-element hit area (measured 32 + 2x6 px; rows keep their height).
      Evidence: 15 analytics + 5 URL-state specs, 8 e2e (pick Uncategorised, legacy URL, source, change category refresh + focus, page fallback, banner link, breakdown bucket, empty state). Tests written after the code (RED not observed).
      Screenshots: 3 rounds. Defects fixed: counter pill hit area, "also create a rule" wrapping on mobile (nowrap, wider description column), table wrapper needed role=region for its aria-label.
      Docs: README "Fixing uncategorised transactions", CLAUDE.md, DESIGN.md (pseudo-element hit area).
      Checks (T14+T15): lint, svelte-check 0 errors, 340 unit tests (server + browser), build, 51 Playwright e2e, drizzle-kit generate => no changes.

## Remaining / future ideas

- Per-category budgets with progress and alerts
- Savings goals
- CSV and other bank importers
- Backups / data export (scheduled mysqldump, CSV export)
- Anomaly alerts (unusual amounts, new recurring charges)
- Client component tests (the browser vitest project currently has none)

## Next step

Push the branch and open a PR (user decision); set HEARTH_IMAGE to the real GHCR path on the server.
