# DESIGN.md — "Stone & Evergreen"

Current, calm, data-friendly family finance. Think a modern fintech product: warm stone ground,
near-black ink, one deep evergreen accent, large quiet numbers. Surfaces are told apart by tone, not
by outlines.

## Principles

1. **Clarity first.** Dense data stays readable: tight hierarchy, generous space, no decoration.
2. **Numbers are the hero.** Tabular figures (`.num`), right-aligned in tables, 40-48px in KPI cards and hero figures with tight tracking.
3. **Tone, not lines.** Cards sit on the ground one tone step away; no card borders, no card shadows. Borders only where a control needs 3:1 (inputs, selects) and for subtle row dividers.
4. **Colour carries meaning, never alone.** Pair colour with icon/text (AA contrast). Accent stays under ~5% of a screen: it marks the action, the current nav item and data.
5. **Mobile-first.** Single column < 640px, 3-up cards from `sm`.

## Colour (tokens in `src/routes/layout.css`, `@theme`)

| Role                       | Token               | Hex                          |
| -------------------------- | ------------------- | ---------------------------- |
| Background (ground)        | `paper`             | #F2F1ED                      |
| Surface                    | `card`              | #FFFFFF                      |
| Divider                    | `line`              | #E6E4DE                      |
| Text                       | `ink` / `ink-soft`  | #1A1915 / #5C5A52            |
| Primary / positive / saved | `primary-50…900`    | #2A8A5A (500), #1B6B44 (600) |
| Attention / overspent      | `attention-100…600` | #C07300 (500)                |
| Highlight / goals          | `highlight-100/500` | #2F6FD6 (blue)               |

Never rely on colour alone to distinguish income from expense. No indigo/violet, no cream plus terracotta.

## Typography

**Geist Variable** (self-hosted via `@fontsource-variable/geist`) for everything. Headlines semibold,
tracking -0.025em; hero numbers -0.035em. Use `.num` on every amount.
Scale: 12 / 14 / 16 / 20 / 28-32 (page title) / 40-48 (KPI and hero numbers) / 60 (landing hero).

## Shape & elevation

Cards: `rounded-card` (16px), `bg-card` on `paper`, no border, no shadow. Only popovers use `shadow-pop`. Pills fully rounded.
Buttons 8-12px radius, 44px min touch target. Dense table rows keep compact visible controls and get the 44px target from an invisible `after:` pseudo-element (`relative` + `after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']`, 32px + 2x6px) rather than taller rows.

## Top bar

`card` tone against the `paper` page, no border. Wordmark "Hearth" in sentence case, semibold, with a small rounded-square mark (primary fill, `on-primary` house glyph). Nav links are pills; the current page is `primary-50` with `primary-700` text and `aria-current="page"`.

## Components (build order)

Summary card · Transaction row · Category chip · Budget progress bar · Goal ring · Member avatar · Empty state.

## Motion

150–200ms ease-out; respect `prefers-reduced-motion`.

## Charts

Use the `dataviz` skill. Series: primary, highlight, attention, then slate; label directly.

## Dark mode

Three-way control in the nav (System / Light / Dark). System is the default and follows `prefers-color-scheme`; the choice is stored in `localStorage` (`hearth-theme`) and applied by an inline script in `app.html` before first paint, which sets `data-theme` (effective theme) and `data-theme-pref` on `<html>`. `color-scheme` is set per theme so native controls, scrollbars and date pickers match. Pure resolution logic: `src/lib/theme/theme.ts`.

Dark is a deep, slightly warm charcoal, never pure black or a pure inversion. Cards are one tone step lighter than the ground, not outlined.

| Token                   | Light                       | Dark                                  |
| ----------------------- | --------------------------- | ------------------------------------- |
| `paper`                 | #F2F1ED                     | #151618                               |
| `card`                  | #FFFFFF                     | #1F2124                               |
| `line`                  | #E6E4DE                     | #2B2D31                               |
| `line-strong`           | #86837A                     | #70747C (form control borders)        |
| `ink` / `ink-soft`      | #1A1915 / #5C5A52           | #ECEBE6 / #A5A39B                     |
| `primary-50/100`        | #E8F2EC / #CFE4D8           | #14291F / #1E4331 (tints)             |
| `primary-500/600`       | #2A8A5A / #1B6B44           | #4CC285 / #3FB377                     |
| `primary-700/900`       | #15583A / #0C3624           | #7FDBA8 / #D3F3E1 (strong = light)    |
| `on-primary`            | #FFFFFF                     | #052013 (text on `primary-600` fills) |
| `attention-100/500/600` | #FBEBCB / #C07300 / #8F5500 | #3A2A0C / #FBBF24 / #FCD34D           |
| `highlight-100/500`     | #E0EAFB / #2F6FD6           | #152647 / #6EA4F8                     |
| `band` / `on-band`      | #0F3A27 / #FFFFFF           | #17382A / #ECEBE6                     |
| `slate-chart`           | #6E6B62                     | #8F9399                               |

Rules:

1. Tints (`*-50`, `*-100`) become dark translucent-looking tints; strong tones (`*-600/700/900`) become light, so `bg-primary-50 text-primary-700` still reads correctly.
2. Text on a filled `primary-600` uses `text-on-primary`, never `text-white`.
3. Never hard-code a colour in a component or chart. Use tokens; charts read them through `dashboard/chart-theme.ts` and re-theme live (`Chart.svelte` observes `data-theme` and the media query).
4. Category colours are stored for light backgrounds. Draw them with `chartColor(color, scheme)` (`src/lib/theme/color.ts`, OKLCH: dark L' = 0.58 + 0.35 L, chroma gamut-clamped) in charts, and with the `.cat-dot` class (`style:--cat={color}`) for dots/chips. Stored colours are never changed.
5. Contrast is enforced by `src/lib/theme/tokens.spec.ts` (text 4.5:1, UI/graphics 3:1, both themes). Add new pairs there.
6. Transitions: only a 180ms colour fade on user toggle (`html.theme-fade`), off under `prefers-reduced-motion`; nothing on load.

Adding a token: add `--t-<name>` to `:root`, to `:root[data-theme='dark']` and to the identical `prefers-color-scheme` block in `layout.css`, expose it in `@theme static` as `--color-<name>: var(--t-<name>)`, then add its contrast pairs to the spec. The spec fails if the three blocks drift.
