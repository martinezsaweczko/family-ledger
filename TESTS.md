# Test inventory

Generated from the test files in the repo (327 tests in 48 files). Kinds: **unit** (vitest, server project; DB tests use throwaway `hearth_test_*` databases and skip when MySQL is down), **component** (vitest browser project), **e2e** (Playwright against `hearth_e2e`, synthetic data only).

Titles are read statically, so parametrised tests (`.each`) count once here but run several times; the vitest total is therefore higher.

Run: `make test` (all), `make unit`, `make e2e`.

## Formats (dates, money, numbers) (27)

**`src/lib/format/date.spec.ts`** · unit · 13

- writes full dates as dd/mm/yyyy
- accepts a timestamp string and keeps garbage untouched
- uses dd/mm for day labels
- keeps English month names for month-only labels
- formats date and time
- checks the calendar
- accepts dd/mm/yyyy and ISO
- rejects impossible or malformed dates
- round-trips through the display format
- inserts slashes while typing
- pads a single digit when the user types a separator
- does not fight backspace
- drops letters

**`src/lib/format/money.spec.ts`** · unit · 11

- formats integer cents as 1.234,56 €
- groups 4-digit amounts too
- formats negative amounts and zero
- shortens axis values
- uses a decimal comma and no grouping
- accepts comma and dot decimals
- accepts thousands separators
- ignores spaces and the euro sign
- rejects garbage
- rejects negatives unless allowed
- round-trips with formatMoneyInput

**`src/lib/format/number.spec.ts`** · unit · 3

- groups integers with dots, always
- uses a decimal comma
- writes percentages as 12,5 %

## Dashboard logic (filters, insights) (26)

**`src/lib/dashboard/filters.spec.ts`** · unit · 18

- this month is month to date
- last month is the previous full calendar month
- last 3/6/12 months cover whole calendar months up to the anchor
- year to date and last year
- all time spans the data and ranges are clamped to the data bounds
- picks a bucket size by range length
- defaults to the last 6 months with automatic granularity
- reads a preset, an explicit granularity, categories and the transfers toggle
- custom from/to wins, is validated and swapped when reversed
- ignores garbage values instead of throwing
- falls back to an empty range when there is no data
- omits defaults and round-trips
- serialises custom ranges and explicit granularity, with extras
- default to off / any, so old URLs keep working
- reads uncategorised=1 alongside categories and a known source
- ignores anything else instead of throwing
- round-trips through buildSearch and omits the defaults
- works without any data too

**`src/lib/dashboard/insights.spec.ts`** · unit · 8

- marks rising income as good and rising expenses as bad, with arrow text
- is neutral for flat or unknown changes
- describes the change against the previous period
- names the top spending category and its share
- states who contributes what share
- sums the recurring commitment
- reports balance movement across the range
- labels buckets by granularity

## Theme and design tokens (25)

**`src/lib/theme/color.spec.ts`** · unit · 10

- matches the WCAG reference values
- is symmetric
- leaves light-theme colours alone when they already contrast
- darkens light-theme colours that would vanish on white
- lifts every swatch to >= 3:1 on the dark card
- keeps the hue family (channel order) when lifting
- keeps the swatches distinguishable in dark
- is deterministic
- passes through values it cannot parse
- accepts 3-digit hex

**`src/lib/theme/theme.spec.ts`** · unit · 6

- accepts the three known values
- falls back to system for anything else
- explicit choices ignore the system preference
- system follows prefers-color-scheme
- treats a stored garbage value as system
- moves through the options with wrap-around

**`src/lib/theme/tokens.spec.ts`** · unit · 5

- define the same set of tokens
- system (media query) block mirrors the explicit dark block exactly
- ${fg} on ${bg} >= ${min}:1
- card is distinguishable from paper
- matches the paper token for both schemes

**`src/routes/theme.e2e.ts`** · e2e · 4

- System follows prefers-color-scheme, live, with no flash
- the choice switches data-theme, color-scheme and persists across reload
- charts re-theme live without errors
- the toggle is reachable on mobile with 44px targets

## Icons (8)

**`src/lib/icons/registry.spec.ts`** · unit · 5

- has an icon for every seeded category, and the seed stores a valid key
- only maps to icons that exist, and every icon draws something
- validates keys strictly (no prototype keys, no unknown strings)
- resolves stored key, then slug default, then fallback
- does not offer the internal uncategorised marker in the picker

**`src/routes/admin/icons.e2e.ts`** · e2e · 3

- chips on the dashboard and the table show category icons and the Supplies name
- the icon picker filters, previews and saves on create and edit
- the server rejects an icon key outside the registry

## Components (6)

**`src/lib/components/DateInput.svelte.spec.ts`** · component · 6

- shows an ISO value as dd/mm/yyyy and submits ISO under the given name
- inserts slashes while typing and updates the hidden ISO value
- rejects impossible dates with an inline message and a blocked submit
- rejects month 13
- exposes a calendar button and the error region is live
- fills the text field from the native picker

## Database, migrations, pool (7)

**`src/lib/server/db/category-data-migration.spec.ts`** · unit · 4

- seeds the new English name and never the old default
- renames an untouched legacy row and backfills the icon
- preserves a name the user edited and an icon the user picked
- backfills every seeded slug from the registry defaults only where icon is NULL

**`src/lib/server/db/migrate.spec.ts`** · unit · 1

- is idempotent and seeds people, categories and rules

**`src/lib/server/db/pool-reuse.spec.ts`** · unit · 2

- creates one pool even when the module is evaluated repeatedly (dev)
- production keeps a module-level singleton and does not touch globalThis

## Importers and dedup (18)

**`src/lib/server/importers/dedup.spec.ts`** · unit · 6

- collapses whitespace and trims
- is a stable 64-char sha256 hex
- ignores internal whitespace differences in the concept
- differs by account, amount and balance
- keeps identical same-day purchases distinct thanks to the balance
- uses an occurrence counter for identical tuples when balance is null

**`src/lib/server/importers/deutsche-bank-xls.spec.ts`** · unit · 5

- detects its own format and rejects others
- parses account, currency and rows (ignoring trailing empty rows)
- converts floats to integer cents with rounding
- keeps the original concept in raw and exposes it as concept
- throws a clear error when the table header is missing

**`src/lib/server/importers/import-service.spec.ts`** · unit · 4

- importing the same file twice inserts nothing the second time
- overlapping exports only insert the new rows
- keeps identical same-day purchases distinct and never overwrites manual categories
- rejects unrecognised files with a clear error

**`src/lib/server/importers/merchant.spec.ts`** · unit · 3

- %s -> %s
- falls back to the trimmed upper-case text when nothing is left
- caps very long names

## Categorisation (rules) (10)

**`src/lib/server/categorizer-service.spec.ts`** · unit · 1

- categorises new rows on import, leaves unknown ones null, keeps manual ones on recategorize

**`src/lib/server/categorizer.spec.ts`** · unit · 9

- matches contains case-insensitively
- matches regex case-insensitively and ignores invalid regexes
- uses the lowest priority number first, then list order
- honours the direction filter
- skips inactive rules
- normalises repeated whitespace before matching
- attributes incoming transfers to the right person
- uses word boundaries for short tokens
- maps cash withdrawals and their reversals

## AI categorisation (45)

**`src/lib/server/ai/categorize-ai.spec.ts`** · unit · 19

- groups identical cleaned merchants per direction and drops unusable text
- applies threshold, unknown slugs and kind mismatch
- is disabled without config and touches nothing
- asks once per distinct merchant, fans the answer out and stores source/confidence/model
- never sends digits, IBANs, dates or names in the request
- applies the confidence threshold, unknown slugs and kind mismatch; leaves those rows uncategorised
- chunks 45 merchants into 3 requests of at most 20
- honours the row bound
- HTTP error, timeout, bad JSON: rows untouched, counted as failed, never throws
- stops at the time budget and reports the rest as failed
- never overwrites manual, rule or already-ai rows
- does not clobber a row the user categorised while the AI was thinking
- recategorizeAll keeps ai rows no rule matches and lets a matching rule replace an ai row
- a manual change or Accept turns ai into manual and clears the ai fields
- Accept can also create a rule that categorises the same merchant elsewhere
- categorises only the new uncategorised rows, reports the AI summary, and skips re-imports
- an AI outage never fails or alters the import
- reports disabled when AI is not configured
- succeeds on a valid JSON reply and reports odd replies and outages

**`src/lib/server/ai/client.spec.ts`** · unit · 8

- is disabled without a base URL or with a bad one
- applies defaults and normalises the URL
- reads overrides and ignores nonsense numbers
- posts the OpenAI chat-completions shape and returns the message text
- sends a bearer token only when a key is configured
- maps HTTP errors, bad JSON and missing content to AiError
- maps network failures and times out hung requests
- is defensive about the response shape

**`src/lib/server/ai/prompt.spec.ts`** · unit · 12

- drops every digit and IBAN-like token
- drops the sender name of incoming transfers
- collapses noise and caps the length
- lists categories and items and demands strict JSON
- contains no dates, IBAN or balance wording, and no stray digits beyond ids and amounts
- keeps a name with a newline on one line
- parses a clean array
- tolerates markdown fences and prose
- accepts an object wrapper, string ids and percent confidences
- clamps out-of-range confidence and defaults a missing one to 0
- skips malformed elements and duplicate ids
- never throws on garbage

**`src/routes/admin/ai.e2e.ts`** · e2e · 6

- disabled when AI_BASE_URL is unset
- admin status line shows model and host only, and Test connection works
- an upload shows the AI summary and AI rows appear with a badge
- the review button categorises what is left, bounded and without breaking
- transactions list shows the AI badge; Accept locks it as manual
- changing the category of an AI row makes it a manual choice

## Analytics (SQL aggregation) (31)

**`src/lib/server/analytics/analytics.spec.ts`** · unit · 11

- summary excludes transfers by default and reports spend as positive numbers
- latest balance comes from the newest day, first-listed row of that day
- compares with the previous period of equal length
- timeSeries zero-fills empty buckets
- categoryBreakdown separates income and expense with shares and monthly averages
- categoryTrend keeps top N and groups the rest into Other
- contributions split salary income by person per bucket
- topMerchants merges normalised names
- recurring finds the monthly subscription and ignores irregular spend
- transactions paginates, searches and sorts
- dataRange reports min/max and counts

**`src/lib/server/analytics/balance.spec.ts`** · unit · 3

- keeps the closing balance of each month and carries it across empty buckets
- leaves buckets before the first known balance out
- returns nothing without data

**`src/lib/server/analytics/buckets.spec.ts`** · unit · 5

- weeks start on Monday
- generates month buckets across a year boundary without gaps
- generates days, weeks and years
- previous period has the same length and ends the day before
- monthsSpan has a floor of one month

**`src/lib/server/analytics/merchants.spec.ts`** · unit · 3

- needs at least 3 charges
- accepts monthly cadence within +-5 days and +-15% amount
- rejects weekly spend and wildly varying amounts

**`src/lib/server/analytics/uncategorised.spec.ts`** · unit · 9

- on its own it selects only rows without a category
- combines with chosen categories as OR
- counts uncategorised rows for the badge, ignoring category and source selections
- keeps totals consistent: uncategorised rows are counted once, in their own bucket
- shows an Uncategorised bucket in the breakdown so nothing is silently dropped
- attention = uncategorised + AI suggestions
- ai, rule, mine, manual and imported
- is ANDed with the category selection and with the uncategorised flag
- affects totals the same way as the list (summary count equals list total)

## Manual and recurring entries (35)

**`src/lib/server/manual/manual.spec.ts`** · unit · 21

- accepts European dates and amounts as typed
- parses amounts, dates and direction for one-off entries
- validates recurring schedules
- creates a one-off entry on the first account, or a synthetic one when none exists
- joins the existing (joint) account when one is already there
- edits and deletes only manual rows, never imported ones
- rejects archived or unknown categories
- weekly: generates every Friday up to the given day and is idempotent
- deterministic hashes stop duplicates even if last_generated is lost
- biweekly and monthly with end-of-month clamping
- income direction yields positive amounts
- an end date stops generation, even later
- ending today stops future generation
- pausing stops generation and resuming does not backfill the gap
- editing affects only future occurrences; a deleted occurrence stays deleted
- deleting offers to also remove generated future entries
- adds only flagged manual entries dated after the bank row
- is null without any bank balance
- flows into breakdowns and transaction lists like any other row
- anchors ranges at the newest non-future row, manual rows included
- never collides between one-offs and recurring rows

**`src/lib/server/manual/schedule.spec.ts`** · unit · 9

- adds days across month and year boundaries
- gives ISO weekdays (Mon=1 .. Sun=7)
- formats today from local parts
- weekly: every anchor weekday from the start date, inclusive range
- is stable regardless of the range window (no drift when started mid-way)
- biweekly: every 14 days from the first matching weekday
- monthly: day of month, clamped to the end of short months
- monthly: never produces a date before the start date
- respects the end date (inclusive) and an empty window

**`src/routes/admin/manual.e2e.ts`** · e2e · 5

- adds a one-off payment that shows on the dashboard with a manual badge
- "adjusts the balance" changes the current balance only when ticked
- a recurring payment is generated, listed, paused and resumed
- imported rows can never be edited or deleted from the manual area
- deleting a recurring payment removes it and keeps history

## Admin logic (categories, rules, overrides, rules import/export) (45)

**`src/lib/server/admin/admin.spec.ts`** · unit · 14

- derives the cleaned merchant from a concept
- lists newest first, paginates and searches
- suggests repeated merchants only
- assigning with "also create a rule" categorises the other matching rows
- assigning without a rule touches only that row and rejects bad input
- a one-click suggestion creates the rule and reports the rows it categorised
- validates input
- creates unique slugs, normalises colour and edits
- archiving hides the category but keeps its statements and rules
- rejects invalid regex, duplicates and unknown categories
- previews matches without changing anything
- moves rules up and down and keeps order stable
- re-apply keeps manual categories and deletes work
- reports unsupported files without failing the others and dedups re-uploads

**`src/lib/server/admin/categories.spec.ts`** · unit · 2

- accepts a registry key and treats empty as "no explicit icon"
- rejects keys outside the registry, including the internal marker and prototype keys

**`src/lib/server/admin/overrides.spec.ts`** · unit · 5

- keeps the override through same-file and superset re-imports and recategorizeAll
- "Remove my change" hands the row back to the rules
- clearing an override with no matching rule leaves the row uncategorised
- validates the category and the statement
- with a rule, reports how many other rows changed and keeps the chosen row manual

**`src/lib/server/admin/rules-file.spec.ts`** · unit · 10

- rejects bad JSON, a wrong format, a wrong version and non-lists
- rejects a huge file before parsing it
- ignores unknown fields and a BOM
- reports each invalid rule with a reason and keeps the valid ones
- flags duplicates inside the file (also by case)
- validates categories (kind, colour, icon, duplicate slug)
- serialises with a stable key order and no ids
- mirrors the case/accent-insensitive unique index
- classifies new, identical (priority alone is ignored), conflicts, missing categories and invalid
- keeps free priorities and appends the rest after the highest, in relative order

**`src/lib/server/admin/rules-io.spec.ts`** · unit · 8

- has a versioned id-free shape and no statement data
- can restrict to active rules and include every category
- round-trips export -> import into an empty database, then is idempotent
- keeps mine by default and uses the imported version on request
- creates missing categories from the file, or skips those rules when asked not to
- appends rules whose priority is taken after the existing ones, keeping their order
- aborts without writing anything when the data became invalid after the preview
- rejects a tampered payload and re-applies rules only to non-manual rows

**`src/routes/admin/admin.e2e.ts`** · e2e · 3

- imports a synthetic file and reports 0 inserted on re-upload
- assigns a category in review and creates a rule for similar rows
- admin pages load

**`src/routes/admin/rules-io.e2e.ts`** · e2e · 3

- export downloads versioned JSON without ids
- upload -> preview -> confirm -> result, then a second import creates nothing
- rejects files that are not rules files

## Security (CSRF) (18)

**`e2e/csrf.e2e.ts`** · e2e · 2

- a real form submission from the page is accepted
- same-host posts pass regardless of scheme, foreign and missing origins are rejected

**`src/lib/server/csrf.spec.ts`** · unit · 16

- allows the same host and port over plain http
- ignores the scheme
- rejects a different host
- rejects a different port
- rejects a missing or empty origin on form posts
- rejects the null origin and malformed origins
- rejects a missing host
- checks %s
- checks a missing content type as a form (browsers can omit it)
- does not check JSON bodies
- never checks %s
- checks %s
- compares hosts case-insensitively
- treats the default port as equal to no port for the scheme
- handles IPv6 hosts
- allows trusted origins (any scheme match is exact, case-insensitive)

## Dashboard pages (e2e) (19)

**`src/routes/dashboard/category-picker.e2e.ts`** · e2e · 1

- closes after Apply and "All categories" clears the selection

**`src/routes/dashboard/dashboard.e2e.ts`** · e2e · 7

- shows a friendly empty state linking to admin when there is no data
- KPIs, charts, banner and recurring list render from the data
- filters live in the URL and change the data
- include transfers and the category picker change what is counted
- drill-down shows category KPIs, charts and a searchable, paged table
- all-transactions explorer paginates, searches and sorts
- unknown categories 404 and bad params do not crash

**`src/routes/dashboard/override.e2e.ts`** · e2e · 3

- changes a row, keeps the URL state, shows the edited badge and can undo it
- also create a rule recategorises the other matching rows
- the drill-down page has the control too

**`src/routes/dashboard/uncategorised.e2e.ts`** · e2e · 8

- the category filter has an Uncategorised option; only those rows show, with a count
- legacy category URLs still work and the badge links to the filtered view
- the Source select narrows by origin and lives in the URL
- changing a category in the filtered view refreshes in place and keeps the keyboard where it was
- emptying the last page goes back to the previous one
- the dashboard banner and the Uncategorised row link to the filtered explorer
- breakdown keeps an Uncategorised bucket so the totals add up
- shows a positive empty state when nothing is uncategorised

## Landing, formats in UI (7)

**`src/routes/admin/formats.e2e.ts`** · e2e · 5

- date field masks, validates and posts; amount takes 1.234,56
- an impossible date does not submit
- the calendar button opens a picker that fills the field
- the filter bar accepts dd/mm/yyyy and the URL carries ISO
- the text fields post dd/mm/yyyy and the server parses it

**`src/routes/page.svelte.e2e.ts`** · e2e · 2

- empty database: invites an import and labels the sample chart
- shows live numbers, the chart and working calls to action

## Not covered by automated tests

- GitHub Actions workflows (`ci.yml`, `docker.yml`) have never run; only YAML-validated.
- The container image was not rebuilt after the latest env changes (smoke test runs only in CI).
- Reverse-proxy flow with `TRUSTED_ORIGINS`.
- AI categorisation against the real service (tests use a mocked `fetch` and `e2e/ai-stub.mjs`).
- Large rule imports (load) and very large statement files.
- Merged "Car & Motorbike" category on a database that already had a separate Motorbike category (no migration exists).
- Closing the category picker by clicking outside it.
- KPI card layout at mid widths (400–1024px), favicon rendering, and the admin menu wrapping on narrow screens: checked by eye or screenshot only.
- Accessibility audits (`web-design-guidelines`) were partly manual; there is no automated axe run.
