# Seasonal themes (Christmas week, New Year)

Objective: automatic festive re-skin of Hearth. Christmas week 20/12-26/12, New Year 31/12-01/01. Approved preview: Claude artifact "Hearth Seasonal Themes".
Scope: colour tokens (light+dark) via `html[data-season]`, CSS-only decorations, fireworks canvas (reduced-motion aware). No admin toggle, no greeting change. `--t-paper` unchanged (theme-color metas must keep matching).
Delivery: ask-on-risk, single PR (~<400 lines expected beyond CSS). Release: v0.3.0 after merge.

## Tasks

- [x] T1 `src/lib/theme/season.ts` pure `seasonFor(date)` + spec; inline mirror in `app.html` (route: delegated writer; test-first)
- [x] T2 season tokens in `layout.css` (xmas, nye; light + dark) + tokens.spec stays green
- [x] T3 `SeasonDecor.svelte` (lights, baubles, trees, drift, candy edge, gift ribbon hook, snow, confetti, sparkles, fireworks, 2027) mounted in `+layout.svelte`
- [x] T4 README/CLAUDE.md note, lint/check/unit/build

## Evidence

(route: delegated direct, one writer; trigger: 2+ non-trivial files)

- T1: season.spec.ts RED (module missing) then GREEN; includes app.html inline-script parity via node:vm
- T2: season-tokens.spec.ts passes all contrast pairs for xmas/nye x light/dark; tokens.spec.ts untouched; --t-paper not overridden
- T3: SeasonDecor.svelte mounted in +layout.svelte; spark step unit-tested; gift ribbon skipped (no clean KpiCard hook)
- T4: CLAUDE.md and README.md notes added; verification run recorded in writer report
