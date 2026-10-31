import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './color.ts';

// The CSS file is the single source of truth: parse the light / dark / system blocks out of it.
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
const system = block("\t:root:not([data-theme='light'])");

describe('token blocks', () => {
	it('define the same set of tokens', () => {
		expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
		expect(Object.keys(system).sort()).toEqual(Object.keys(light).sort());
	});
	it('system (media query) block mirrors the explicit dark block exactly', () => {
		expect(system).toEqual(dark);
	});
});

// [foreground, background, minimum ratio, why]
const TEXT = 4.5;
const UI = 3;
const PAIRS: [string, string, number][] = [
	['ink', 'paper', TEXT],
	['ink', 'card', TEXT],
	['ink-soft', 'paper', TEXT],
	['ink-soft', 'card', TEXT],
	['primary-600', 'card', TEXT],
	['primary-600', 'paper', TEXT],
	['primary-700', 'primary-50', TEXT],
	['primary-900', 'primary-50', TEXT],
	['primary-700', 'card', TEXT],
	['on-primary', 'primary-600', TEXT],
	['on-primary', 'primary-700', TEXT],
	['attention-600', 'card', TEXT],
	['attention-600', 'attention-100', TEXT],
	['ink', 'attention-100', TEXT],
	['ink', 'primary-50', TEXT],
	['on-band', 'band', TEXT],
	['on-band-soft', 'band', TEXT],
	// UI components and graphics (WCAG 1.4.11)
	['primary-500', 'card', UI],
	['attention-500', 'card', UI],
	['highlight-500', 'card', UI],
	['slate-chart', 'card', UI],
	['line-strong', 'card', UI],
	['line-strong', 'paper', UI],
	['primary-600', 'paper', UI]
];

for (const [name, tokens] of [
	['light', light],
	['dark', dark]
] as const) {
	describe(`contrast (${name})`, () => {
		for (const [fg, bg, min] of PAIRS) {
			it(`${fg} on ${bg} >= ${min}:1`, () => {
				const ratio = contrast(tokens[fg], tokens[bg]);
				expect(
					ratio,
					`${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} = ${ratio.toFixed(2)}`
				).toBeGreaterThanOrEqual(min);
			});
		}
		it('card is distinguishable from paper', () => {
			expect(tokens.card).not.toBe(tokens.paper);
		});
	});
}

describe('meta theme-color', () => {
	const html = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
	it('matches the paper token for both schemes', () => {
		expect(html).toContain(`content="${light.paper}"`);
		expect(html).toContain(`content="${dark.paper}"`);
	});
});
