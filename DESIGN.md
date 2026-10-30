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
Buttons 8–12px radius, 44px min touch target.

## Components (build order)

Summary card · Transaction row · Category chip · Budget progress bar · Goal ring · Member avatar · Empty state.

## Motion

150–200ms ease-out; respect `prefers-reduced-motion`.

## Charts

Use the `dataviz` skill. Series: primary, highlight, attention, then slate; label directly.
