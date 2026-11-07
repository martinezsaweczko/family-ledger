# ui-polish-landing-scroll

Branch: `feat/ui-polish-landing-scroll`. Engram mirror: pending (memory tools not available this session).

## Objective

Polish the landing page, dashboard, transactions, category and admin screens so Hearth looks like a professional product, using the design-taste-frontend skill (app-screen run: `references/app-screens.md`). Add a looping, infinite-scroll drawn-illustration background to the landing page `/`.

## Decisions (user)

- No login/auth exists; the scrolling background goes on the landing page `/` (no auth added).
- Background is a drawn, seamless looping illustration in code, DESIGN.md palette, no external images.

## Constraints

- DESIGN.md + `@theme` in `src/routes/layout.css` stay the source of truth; token names kept; never hard-code colours; light and dark values for every token.
- Svelte 5 runes, `#lib/...` imports, European formats via `#lib/format/`, no behaviour/route/form changes.
- `prefers-reduced-motion`: background stops. Text over the background must stay readable (AA) in both themes.
- ~400 changed lines per task is a heuristic only.

## Tasks

- [x] T1 Landing `/` polish + infinite-scroll drawn background (component `ScrollBackdrop.svelte`) — route: delegated writer (2+ non-trivial files)
- [x] T2 Dashboard shell + `/dashboard` polish (layout.css, KpiCard, FilterBar, charts surroundings)
- [ ] T3 `/dashboard/transactions` + `/dashboard/category/[slug]` polish (TransactionTable, Pager, chips)
- [ ] T4 Admin screens polish (`/admin/*`)

## Checks

`npm run lint`, `npm run check`, `npm run test:unit -- --run`, `npm run test:e2e` (needs MySQL), skill `inspect.mjs --app` screenshots at 1440/768/390 where Chrome is available.

## Progress / evidence

- T2 (delegated writer): lint, check, 340 unit, 23 e2e pass; parent viewed 768 light screenshot, clean. Known: Top merchants card has ~100px spare space at 1440. KpiCard/FilterBar are shared with other pages.
- T1 (delegated writer): lint, check, 340 unit tests, build pass; e2e `page.svelte.e2e.ts` + `theme.e2e.ts` 7/7 pass (parent re-ran). Screenshots reviewed at 1440 light and 390 dark only; drift not observed live. Eyebrow above h1 dropped (skill rule); DESIGN.md wins on card borders/shadows.
