# Hearth

Hearth is a small, self-hosted household finance dashboard for two people on a home LAN. You import
bank statements by hand, Hearth stores every row in MySQL without ever double counting, categorises
the movements, and shows where the money comes from and where it goes: income vs expenses, category
breakdowns and trends, who contributes what, top merchants and recurring payments.

There is no login: run it only on a trusted network. All amounts are stored as integer cents.
Built with SvelteKit 3 (Svelte 5), Drizzle ORM, MySQL 8.4 and Apache ECharts.

## Quick start (development)

Needs Node 24 (`.nvmrc`) and podman or docker.

```sh
cp .env.example .env              # DATABASE_URL already points at the compose database
podman compose up -d db           # or: docker compose up -d db
npm install
npm run dev
```

Or use the Makefile (`make help` lists everything): `make run` starts MySQL and the dev server,
`make test` / `make unit` / `make e2e` run the tests, `make ci` runs lint, check, tests and build,
`make db` / `make db-reset` start or wipe the local database, `make image` builds the container,
`make lint`, `make check` and `make clean` do what they say.

Open the printed URL. On start the server waits for MySQL, applies the migrations in `/drizzle`
and seeds the default categories, rules and people, so there is nothing to set up by hand.

## Importing a statement

1. Open **Admin > Imports** (`/admin`).
2. Upload the bank file (currently the Deutsche Bank "Movimientos" `.xls`). The importer is
   auto-detected from the file.
3. The result shows how many rows were inserted, updated or unchanged. Uploading the same or an
   overlapping file again is safe.
4. Open **Review** to give a category to what the rules could not classify; optionally create a rule
   from the same screen so the next import categorises it automatically.

Bank files are never committed (`*.xls`, `*.xlsx` and `/samples` are git-ignored). Tests use
synthetic data with fake IBANs and merchants.

## Adding a new importer

Importers are plugins; the interface is in `src/lib/server/importers/types.ts`.

1. Create `src/lib/server/importers/<bank>.ts` exporting an `Importer`:
   - `id`, `label`, `accepts` (lowercase extensions such as `['.csv']`);
   - `detect(buf, filename)`: return `true` only for files in your format;
   - `parse(buf)`: return `{ account: { iban, currency }, rows }` where each row has ISO
     `bookingDate`/`valueDate`, `concept`, signed integer `amountCents` (negative = money out),
     `balanceCents` (or `null`) and the untouched source row in `raw`.
2. Register it with one line in `src/lib/server/importers/registry.ts` (add it to the `importers` array).
3. Add a spec next to it using a synthetic fixture (see `test-fixtures.ts` and
   `deutsche-bank-xls.spec.ts`). Never use real bank data.

Deduplication, categorisation and storage are shared, so a new importer needs nothing else.

## Categories and rules

**Formats.** The interface is in English but uses European formats everywhere: dates `dd/mm/yyyy`, money
`1.234,56 €`, percentages `12,5 %`. Date fields accept typing (slashes are inserted for you) or a calendar
picker and reject impossible dates; amount fields accept `40,50`, `40.5` or `1.234,56`.

Each movement belongs to one category (groceries, supplies, salary contributions and so on; some are
flagged as transfer/ignore and are excluded from totals unless the dashboard "include transfers"
option is on). Rules (**Admin > Rules**) assign a category by matching the concept text with
`contains` or `regex`, with a priority, a direction (in/out) and an active flag. Rules run on newly
imported rows that have no category yet. A category you set by hand is never overwritten by rules or
re-imports. Every transaction row on the dashboard (Transactions and category pages) has a
**Change category** control: pick another category, optionally also create a rule from it, or
**Remove my change** to let the rules decide again. Changed rows show an "edited" badge and keep
their category through re-imports, overlapping imports and re-applying rules; amounts and dates of
imported rows can never be edited. Each category has an icon (picked from a curated set in **Admin > Categories**) shown
next to its name everywhere. Salary transfers can be attributed to a person, which feeds the contributions chart.

## Backing up and sharing rules

**Admin > Rules > Import / export** moves your categorisation rules (and the categories they use)
between installs or into a backup, as a small human-readable JSON file `hearth-rules-YYYY-MM-DD.json`.

- **Export** (`GET /admin/rules/export`, optional `?active=1` for active rules only and `?categories=all`
  for every category). Format `hearth.rules`, `version: 1`, keys in a fixed order. Rules point to
  categories by slug and to people by name, never by database id. No statements, amounts, IBANs or
  account data are ever exported.
- **Import** is a two-step flow. Upload (up to 2 MB) shows a **preview** and writes nothing: new rules,
  identical rules (skipped), conflicts (same pattern and match type already exist with a different
  category, direction, person or active flag), rules whose category does not exist here, and invalid
  entries with the reason (bad regex, unknown enum, over-long pattern, duplicates in the file, unknown
  category or person). Unknown fields are ignored. Choose how to treat conflicts (**keep mine**, the
  default, or **use the imported version**), whether to **create the missing categories** from the
  file's definitions (default on; a rule whose category is neither here nor defined in the file is
  invalid and skipped) and whether to **re-apply rules** afterwards (default on; manual categories are
  never touched, same precedence as everywhere else). **Import now** then writes everything in one
  database transaction: it is all-or-nothing, and the server re-validates and re-diffs the file instead
  of trusting the preview (if entries became invalid in between, nothing is written). A result summary
  lists rules created/updated/skipped, categories created and rows recategorised.
- **Idempotent**: importing the same file twice creates nothing the second time. There is no
  "replace everything" mode; nothing is ever deleted by an import.
- **Priorities.** An imported priority is kept when no existing rule uses that number; otherwise the
  rule is appended after the highest priority in use, in steps of 10, keeping the relative order it had
  in the file (priority, then position). Rules without a priority are appended the same way. The
  priority of a rule that already exists is never changed (a difference in priority alone is not a
  conflict). "Use the imported version" updates category, direction, person and active flag.
- Pattern identity follows the database unique index (pattern + match type, case- and accent-insensitive).

This is also the easy way to share a good rule set between two installs or to keep a copy before bigger
edits. For the data itself use the database dump below.

## Manual and recurring payments

Some payments never reach the bank file (for example a cleaner paid in cash every Friday). **Admin >
Manual** lets you add them once, or as a recurring payment (weekly, every two weeks, monthly, with
an optional end date; pause, resume, edit and end whenever you like). They are stored as rows with
importer `manual` on the joint account (a synthetic "Manual entries" account is created only if no bank
file was ever imported), show a "manual" badge in every table, and flow into every chart, list and
recurring-charge detection like any bank movement. Only manual rows can be edited or deleted, and only
there; imported rows never.

- **Recurring entries** are generated up to today when the server starts and (at most once a day) when
  a dashboard or the landing page loads. Generation is idempotent (deterministic id per recurring entry
  and date), a deleted occurrence is not re-created, editing a recurring payment only affects entries
  not yet generated, and resuming a paused one does not backfill the gap. Monthly entries on day 29-31
  use the last day of shorter months.
- **Balance**: a manual entry does not change the displayed balance unless you tick "Paid from the
  joint account (adjusts the balance)". The current balance is the latest bank balance plus the
  ticked manual entries dated after that bank row's date (same-day entries are assumed to be in the
  bank balance already). The balance-over-time chart shows bank balances only.
- **Date anchor**: dashboard ranges end at the newest booking date over all rows, bank and manual, that
  is not in the future. A weekly manual entry after the last import therefore still shows in "This
  month", but it also moves "now" forward: if you have not imported for a while, the presets will
  cover mostly the manual rows until you import again.
- **Cash withdrawals** in the bank file are already counted under "Cash withdrawals". Entering the cash
  you spent as manual spending on top of that counts it twice; put the withdrawal in "Internal
  transfer" or leave it as it is. Hearth does not decide this for you.

## AI categorisation (optional)

Rows the rules cannot place can be categorised by your own internal AI service. It must speak the
OpenAI chat-completions protocol: Hearth sends `POST <AI_BASE_URL>/v1/chat/completions` with
`{"messages":[...],"model":"haiku","stream":false,"temperature":0}` and reads
`choices[0].message.content`. Set `AI_BASE_URL` (see `.env.example`); when it is unset the feature is
simply off and nothing is ever sent anywhere.

- **When**: automatically after each import (only the new, still-uncategorised rows, at most 200 rows
  and about 60 s per import; an AI failure never fails the import) and on demand with **Categorise with
  AI** on Admin > Review (same bounds per click).
- **What is sent**: only the cleaned merchant text (no digits, no IBAN-like tokens, no sender names of
  incoming transfers), the direction (in/out) and the amount rounded to whole euros, plus the list of
  your active categories. Never the IBAN, balance, account, dates or the raw bank line. Identical
  merchants are asked once, up to 20 per request.
- **How it is applied**: the model answers with a category slug and a confidence. Answers below
  `AI_MIN_CONFIDENCE`, unknown categories and inconsistent ones (money out as income; money in as an
  expense unless confidence is at least 0.8, as a refund) are ignored and the row stays uncategorised.
- **Precedence**: manual > rule > ai > uncategorised. The AI never overwrites a manual or rule category;
  re-applying the rules replaces an AI category only when a rule matches, and leaves other AI rows alone.
- **Reviewing**: AI rows carry an "AI · 82 %" badge in the transaction lists and are listed under
  **Categorised by AI** on the review page. **Accept** locks the category as your own (optionally also
  creating a rule); **Change category** overrides it (also manual).
- **Admin**: Admin > Imports shows whether AI is enabled (model and host only), the last run, and a
  **Test connection** button that sends one synthetic prompt.

## Dedup guarantee

Every row gets `dedup_hash = sha256(account | booking date | value date | concept | amount | balance after)`
and is upserted on it. Re-importing a file, or an overlapping export, does not create duplicate rows
and does not touch manual categories. Two genuinely identical movements on the same day stay distinct
because the balance after each differs. The original source row is kept verbatim in `raw_json`.

## Configuration

| Variable                  | Where               | Default / example                             | Purpose                                                         |
| ------------------------- | ------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`            | app                 | `mysql://hearth:hearth@127.0.0.1:3306/hearth` | MySQL connection (required)                                     |
| `BODY_SIZE_LIMIT`         | app                 | `25M` in the image                            | Max upload size (adapter-node default is only 512K)             |
| `AI_BASE_URL`             | app                 | unset (AI off), e.g. `https://ai.example.lan` | Base URL of an OpenAI-compatible chat-completions service       |
| `AI_MODEL`                | app                 | `haiku`                                       | Model name sent to that service                                 |
| `AI_API_KEY`              | app                 | unset                                         | Optional bearer token (`Authorization: Bearer ...`)             |
| `AI_TIMEOUT_MS`           | app                 | `30000`                                       | Per-request timeout                                             |
| `AI_MIN_CONFIDENCE`       | app                 | `0.6`                                         | Answers below this confidence (0-1) are ignored                 |
| `PORT` / `HOST`           | app                 | `3000` / `0.0.0.0`                            | Listen address inside the container                             |
| `TRUSTED_ORIGINS`         | app                 | unset                                         | Extra origins allowed to submit forms (reverse proxy only)      |
| `MIGRATIONS_DIR`          | app                 | `./drizzle` from the working directory        | Override the migrations folder                                  |
| `TEST_DATABASE_ADMIN_URL` | tests               | `mysql://root:root@127.0.0.1:3306`            | Root URL for throwaway `hearth_test_*` / `hearth_e2e` databases |
| `HEARTH_IMAGE`            | `compose.prod.yaml` | `ghcr.io/OWNER/REPO:latest`                   | Image to deploy                                                 |
| `MYSQL_ROOT_PASSWORD`     | `compose.prod.yaml` | required                                      | MySQL root password                                             |
| `MYSQL_PASSWORD`          | `compose.prod.yaml` | required                                      | Password of the `hearth` DB user (use URL-safe characters)      |
| `HEARTH_PORT`             | `compose.prod.yaml` | `3000`                                        | Host port published on the LAN                                  |

### Form submissions over plain http (CSRF)

Hearth is meant to run on a LAN over plain http (e.g. `http://192.168.1.50:3000`). adapter-node
assumes `https` unless told otherwise, which makes SvelteKit's built-in origin check reject every
form POST, and the runtime `ORIGIN` variable does not change that. The built-in check is therefore
disabled and replaced by an equivalent one (`src/lib/server/csrf.ts`): for POST/PUT/PATCH/DELETE
requests with a form content type, the `Origin` header must be present and have the same
host and port as the `Host` header; the scheme is ignored. No setup is needed for direct access.
Behind a reverse proxy that rewrites `Host`, set `TRUSTED_ORIGINS` to the public origin(s),
comma-separated, e.g. `TRUSTED_ORIGINS=https://hearth.example.lan`.

## Release and deploy

`.github/workflows/docker.yml` is the entry pipeline. On every pull request and push it runs the
tests (`ci.yml`: lint, svelte-check, migration drift check, unit and integration tests, build and
Playwright e2e against a MySQL service container), then builds the image and smoke-tests it against
a real MySQL (waits for `/` to return 200 and checks that the tables exist). Only pushes to `main` and
`v*` tags, after everything passed, publish the image to GHCR (`ghcr.io/<owner>/<repo>`, tags: branch,
`latest`, semver, sha). Pull requests never push.

To deploy on the home server:

```sh
cp .env.example .env     # set HEARTH_IMAGE, MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD (long random values)
podman compose -f compose.prod.yaml up -d      # or: docker compose -f compose.prod.yaml up -d
```

The stack runs the app (non-root, with a health check) and MySQL 8.4 with a named volume, restarts
unless stopped, and publishes only the app port; the database is reachable only inside the compose
network. Tables are created and seeded by the app on first start. If the GHCR package is private,
log in first (`podman login ghcr.io`). To upgrade, pull the new tag and run `up -d` again; new
migrations apply automatically.

## Testing

```sh
npm run lint                       # prettier + eslint
npm run check                      # svelte-check
npm run test:unit -- --run         # vitest: server project (+ browser component project)
npx playwright install chromium   # once
npx playwright test                # e2e on a throwaway hearth_e2e database
```

DB integration tests and e2e need MySQL (`podman compose up -d db`); integration tests skip when it is
unreachable. After editing `src/lib/server/db/schema.ts` run `npm run db:generate` and commit the new
migration; CI fails if schema and `/drizzle` drift apart.

## Backup

All data lives in the `hearth-db` volume (named `<project>_hearth-db`). Take a logical dump regularly:

```sh
podman compose -f compose.prod.yaml exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction hearth' > hearth-$(date +%F).sql
```

Restore into an empty database with `mysql -uroot -p hearth < hearth-YYYY-MM-DD.sql`. Keep dumps off
the server; they contain your financial data.
