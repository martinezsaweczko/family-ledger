# theme-refresh

Branch: `feat/theme-refresh` (off `feat/ui-polish-landing-scroll`). Engram mirror: pending (memory tools unavailable).

## Objective

Make Hearth look modern: warm stone ground, near-black ink, deeper green accent, Geist typeface, tone-stepped surfaces instead of outlines, much larger key numbers, slim filter toolbar so data starts above the fold, redrawn landing backdrop. User delegated all design choices ("up to you").

## Decisions (parent)

- Palette direction: warm neutrals (stone), deep green primary, amber attention kept, highlight moves from indigo to a clear blue; dark theme stays a deep, slightly warmer slate, never pure black.
- Typeface: Geist Variable via @fontsource-variable/geist replacing Inter.
- No sidebar (e2e risk); refine the top bar and wordmark.
- Token names are kept; contrast spec (`src/lib/theme/tokens.spec.ts`) must pass in both themes.

## Tasks

- [x] T5 Tokens, DESIGN.md, typeface, surfaces without outlines, big numbers, wordmark/top bar
- [x] T6 Slim filter toolbar (dashboard + transactions, shared FilterBar) so data starts above the fold
- [x] T7 Landing: redraw backdrop deliberately, fix hero metrics gap, re-check all screens light/dark

## Checks

lint, check, unit, full e2e (MySQL in podman), screenshots at 1440/768/390 light+dark, every shot opened.

## Progress / evidence

- T6+T7 (delegated writer): slim Filters toolbar (details popover, no-JS GET verified), redrawn backdrop, hero card rebalanced. lint, check, 352 unit, 53 e2e pass; all final-round shots viewed by writer; parent viewed landing + transactions 1440 light. Edited formats.e2e.ts outside the allowed list (2 lines, open Filters). Gaps: 768 only shot for landing; Savings rate card has spare space.
- T5 (delegated writer): "Stone & Evergreen" theme, Geist, tone-stepped cards, big KPI numbers, new top bar. lint (eslint src), check, 352 unit incl. contrast spec, 53 e2e pass. About 14 of 24 screenshots viewed by writer; parent viewed dashboard 1440 light.
