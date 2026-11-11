import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './color.ts';

const css = readFileSync(new URL('../../routes/layout.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
	const open = css.indexOf(selector + ' {');
	if (open < 0) throw new Error(`block not found: ${selector}`);
	const body = css.slice(css.indexOf('{', open) + 1, css.indexOf('}', open));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/--t-([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
	return out;
}

const light = block(':root');
const dark = block(":root[data-theme='dark']");

const TEXT = 4.5;
const UI = 3;
// Pairs that involve at least one token a season overrides (same bar as tokens.spec.ts).
const PAIRS: [string, string, number][] = [
	['primary-600', 'card', TEXT],
	['primary-600', 'paper', TEXT],
	['primary-700', 'primary-50', TEXT],
	['primary-900', 'primary-50', TEXT],
	['primary-700', 'card', TEXT],
	['primary-700', 'paper', TEXT],
	['on-primary', 'primary-600', TEXT],
	['on-primary', 'primary-700', TEXT],
	['attention-600', 'card', TEXT],
	['attention-600', 'attention-100', TEXT],
	['ink', 'attention-100', TEXT],
	['on-band', 'band', TEXT],
	['on-band-soft', 'band', TEXT],
	['primary-500', 'card', UI],
	['primary-500', 'paper', UI],
	['primary-600', 'paper', UI],
	['attention-500', 'card', UI],
	['attention-500', 'paper', UI],
	['season-accent', 'card', UI],
	['season-accent', 'paper', UI]
];

const SEASONS = ['xmas', 'nye'] as const;
const OVERRIDDEN = [
	'band',
	'on-band-soft',
	'primary-500',
	'primary-600',
	'primary-700',
	'primary-900',
	'attention-100',
	'attention-500',
	'attention-600',
	'season-accent',
	'deco-a',
	'deco-b',
	'deco-c'
];

for (const season of SEASONS) {
	const lightSeason = block(`:root[data-season='${season}']`);
	const darkSeason = block(`:root[data-theme='dark'][data-season='${season}']`);
	const systemSeason = block(`\t:root:not([data-theme='light'])[data-season='${season}']`);

	describe(`season ${season}`, () => {
		it('overrides the same tokens in every scheme', () => {
			expect(Object.keys(lightSeason).sort()).toEqual([...OVERRIDDEN].sort());
			expect(Object.keys(darkSeason).sort()).toEqual([...OVERRIDDEN].sort());
		});
		it('never touches paper (theme-color metas must keep matching)', () => {
			for (const b of [lightSeason, darkSeason, systemSeason])
				expect(b).not.toHaveProperty('paper');
		});
		it('system (media query) block mirrors the explicit dark block exactly', () => {
			expect(systemSeason).toEqual(darkSeason);
		});

		for (const [scheme, base, over] of [
			['light', light, lightSeason],
			['dark', dark, darkSeason]
		] as const) {
			const tokens = { ...base, ...over };
			describe(`contrast (${scheme})`, () => {
				for (const [fg, bg, min] of PAIRS) {
					it(`${fg} on ${bg} >= ${min}:1`, () => {
						const ratio = contrast(tokens[fg], tokens[bg]);
						expect(
							ratio,
							`${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} = ${ratio.toFixed(2)}`
						).toBeGreaterThanOrEqual(min);
					});
				}
			});
		}
	});
}
