# DESIGN.md — "Clear Slate"

Modern, precise, data-friendly family finance. Think a clean fintech dashboard:
cool neutrals, one confident teal, thin borders, almost flat surfaces.

## Principles

1. **Clarity first.** Dense data stays readable: tight hierarchy, thin 1px borders, little shadow.
2. **Numbers are the hero.** Tabular figures (`.num`), right-aligned in tables, large in summary cards.
3. **Colour carries meaning, never alone.** Pair colour with icon/text (AA contrast).
4. **Mobile-first.** Single column < 640px, 3-up cards from `sm`.

## Colour (tokens in `src/routes/layout.css`, `@theme`)

| Role                       | Token               | Hex               |
| -------------------------- | ------------------- | ----------------- |
| Background                 | `paper`             | #F6F8FA           |
| Surface                    | `card`              | #FFFFFF           |
| Border                     | `line`              | #DDE3EA           |
| Text                       | `ink` / `ink-soft`  | #0F1B2A / #566577 |
| Primary / positive / saved | `primary-50…900`    | #0F9488 (500)     |
| Attention / overspent      | `attention-100…600` | #E08A00 (500)     |
| Highlight / goals          | `highlight-100/500` | #4F5BD5           |

Never rely on colour alone to distinguish income from expense.

## Typography

**Inter Variable** (self-hosted via @fontsource) for everything. Headlines semibold, tracking -0.02em.
Use `.num` on every amount. Scale: 12 / 14 / 16 / 20 / 30 / 48.

## Shape & elevation

Cards: `rounded-card` (12px), 1px `line` border, `shadow-card` (hairline). Pills fully rounded.
Buttons 8–12px radius, 44px min touch target. Dense table rows keep compact visible controls and get the 44px target from an invisible `after:` pseudo-element (`relative` + `after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']`, 32px + 2x6px) rather than taller rows.

## Components (build order)

Summary card · Transaction row · Category chip · Budget progress bar · Goal ring · Member avatar · Empty state.

## Motion

150–200ms ease-out; respect `prefers-reduced-motion`.

## Charts

Use the `dataviz` skill. Series: primary, highlight, attention, then slate; label directly.

## Dark mode

Three-way control in the nav (System / Light / Dark). System is the default and follows `prefers-color-scheme`; the choice is stored in `localStorage` (`hearth-theme`) and applied by an inline script in `app.html` before first paint, which sets `data-theme` (effective theme) and `data-theme-pref` on `<html>`. `color-scheme` is set per theme so native controls, scrollbars and date pickers match. Pure resolution logic: `src/lib/theme/theme.ts`.

Dark is a deep blue-slate, never pure black or a pure inversion. Surfaces are separated by borders, not shadows (`--shadow-card: none`).

| Token                   | Light                       | Dark                                  |
| ----------------------- | --------------------------- | ------------------------------------- |
| `paper`                 | #F6F8FA                     | #0B1220                               |
| `card`                  | #FFFFFF                     | #111A2B                               |
| `line`                  | #DDE3EA                     | #223047                               |
| `line-strong`           | #7A8A9C                     | #5D7089 (form control borders)        |
| `ink` / `ink-soft`      | #0F1B2A / #566577           | #E6EDF5 / #93A4B8                     |
| `primary-50/100`        | #E6F6F4 / #C2EBE6           | #0E2B2E / #164A4A (tints)             |
| `primary-500/600`       | #0F9488 / #0B7A70           | #2DD4BF / #2BC9B5                     |
| `primary-700/900`       | #0A6159 / #063A35           | #5EEAD4 / #CCFBF1 (strong = light)    |
| `on-primary`            | #FFFFFF                     | #04201C (text on `primary-600` fills) |
| `attention-100/500/600` | #FDECCD / #C97A00 / #965A00 | #3A2A0C / #FBBF24 / #FCD34D           |
| `highlight-100/500`     | #E4E7FB / #4F5BD5           | #1F2447 / #8B93F5                     |
| `band` / `on-band`      | #063A35 / #FFFFFF           | #0F2E33 / #E6EDF5                     |

Rules:

1. Tints (`*-50`, `*-100`) become dark translucent-looking tints; strong tones (`*-600/700/900`) become light, so `bg-primary-50 text-primary-700` still reads correctly.
2. Text on a filled `primary-600` uses `text-on-primary`, never `text-white`.
3. Never hard-code a colour in a component or chart. Use tokens; charts read them through `dashboard/chart-theme.ts` and re-theme live (`Chart.svelte` observes `data-theme` and the media query).
4. Category colours are stored for light backgrounds. Draw them with `chartColor(color, scheme)` (`src/lib/theme/color.ts`, OKLCH: dark L' = 0.58 + 0.35 L, chroma gamut-clamped) in charts, and with the `.cat-dot` class (`style:--cat={color}`) for dots/chips. Stored colours are never changed.
5. Contrast is enforced by `src/lib/theme/tokens.spec.ts` (text 4.5:1, UI/graphics 3:1, both themes). Add new pairs there.
6. Transitions: only a 180ms colour fade on user toggle (`html.theme-fade`), off under `prefers-reduced-motion`; nothing on load.

Adding a token: add `--t-<name>` to `:root`, to `:root[data-theme='dark']` and to the identical `prefers-color-scheme` block in `layout.css`, expose it in `@theme static` as `--color-<name>: var(--t-<name>)`, then add its contrast pairs to the spec. The spec fails if the three blocks drift.
