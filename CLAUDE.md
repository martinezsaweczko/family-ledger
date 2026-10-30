# CLAUDE.md — Hearth (family finance app)

SvelteKit 3 + Svelte 5 (runes) + TypeScript + Tailwind CSS 4. Node adapter, shipped as a container.
Product scope is still being defined; keep the skeleton small until requirements arrive.

## Commands

- `npm run dev` — dev server
- `npm run check` — svelte-check / types
- `npm run lint` — prettier + eslint
- `npm run test:unit -- --run` — vitest (server + browser component projects)
- `npm run test:e2e` — playwright (builds and previews the app)
- `npm run build` — production build to `build/` (`node build`)
- `docker build -t hearth .` — container image

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$props`); no legacy `export let` / stores for local state.
- Import shared code via the `#lib/...` package import (SvelteKit 3 removed `$lib`).
- **Money is integer cents**, formatted only at the edge with `#lib/format/money.ts`. Never floats.
- Server-only code in `src/lib/server/`. Secrets via `$env/dynamic/private`; never commit `.env`.
- Tests next to code: `*.spec.ts` (unit), `*.svelte.spec.ts` (component), `*.e2e.ts` (playwright).
- Conventional Commits. Small, tested changes.

## Design

Follow [DESIGN.md](DESIGN.md) ("Clear Slate"): tokens in `src/routes/layout.css`, Inter,
tabular numbers for amounts, calm palette (primary teal / attention amber / highlight indigo on cool slate).

## Skills to use

Installed in `.claude/skills/`. `DESIGN.md` is the source of truth: skills must follow its tokens, never invent a palette.

- **design-taste-frontend** (Taste) — art direction and anti-"AI slop" polish for pages and app screens.
- **web-design-guidelines** — audit UI for accessibility/UX before finishing a UI change (`file:line` findings).
- **screenshot-to-code** (stands in for ImageToCode) — turn mockups/screenshots into components. Output must be **Svelte 5 runes + Tailwind 4** using the tokens in `src/routes/layout.css`, not React.
- Awesome-design-md is not a skill: it is a collection of brand `DESIGN.md` files (VoltAgent/awesome-design-md). Borrow patterns from it into `DESIGN.md` when needed.

## Changing the design

The design lives in two places only: `DESIGN.md` (rules) and the `@theme` block in `src/routes/layout.css` (tokens). To restyle, edit both, keep token names, and components follow. Never hardcode colours in components.

## CI/CD

- `.github/workflows/ci.yml`: lint, check, unit tests, build, e2e on every PR/push.
- `.github/workflows/docker.yml`: on `main` and `v*` tags, builds and pushes image to GHCR.

## Gotchas

- `engine-strict=true`; Node 24 (see `.nvmrc`).
- Playwright browsers are needed for component and e2e tests (`npx playwright install --with-deps chromium`).
