import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { burst, seasonFor, stepSparks, type Season } from './season.ts';

// [month (1-12), day, expected]
const TABLE: [number, number, Season | null][] = [
	[6, 15, null],
	[12, 19, null],
	[12, 20, 'xmas'],
	[12, 23, 'xmas'],
	[12, 26, 'xmas'],
	[12, 27, null],
	[12, 30, null],
	[12, 31, 'nye'],
	[1, 1, 'nye'],
	[1, 2, null],
	// Same day numbers in other months must not match.
	[11, 20, null],
	[1, 31, null],
	[11, 1, null]
];

describe('seasonFor', () => {
	for (const [m, d, expected] of TABLE) {
		it(`${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} -> ${expected}`, () => {
			expect(seasonFor(new Date(2026, m - 1, d, 12))).toBe(expected);
		});
	}
	it('uses the local calendar day at the edges of the day', () => {
		expect(seasonFor(new Date(2026, 11, 20, 0, 0, 0))).toBe('xmas');
		expect(seasonFor(new Date(2026, 11, 26, 23, 59, 59))).toBe('xmas');
		expect(seasonFor(new Date(2026, 11, 27, 0, 0, 0))).toBeNull();
	});
});

describe('app.html pre-paint script', () => {
	// Run the inline script against a fake document and compare with seasonFor().
	const html = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
	const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];

	function seasonFromInline(now: Date): string | undefined {
		const dataset: Record<string, string> = {};
		const sandbox = {
			localStorage: { getItem: () => null },
			window: { matchMedia: () => ({ matches: false }) },
			document: {
				documentElement: { dataset },
				querySelectorAll: () => []
			},
			Date: class extends Date {
				constructor() {
					super(now.getTime());
				}
			}
		};
		vm.runInNewContext(script!, sandbox);
		return dataset.season;
	}

	it('exists', () => {
		expect(script).toBeTruthy();
	});
	for (const [m, d, expected] of TABLE) {
		it(`agrees with seasonFor() on ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`, () => {
			expect(seasonFromInline(new Date(2026, m - 1, d, 12))).toBe(expected ?? undefined);
		});
	}
});

describe('fireworks', () => {
	const seq = (values: number[]) => {
		let i = 0;
		return () => values[i++ % values.length];
	};

	it('burst makes the requested number of sparks at the origin', () => {
		const sparks = burst(10, 20, 2, seq([0, 0.5, 1]), 5);
		expect(sparks).toHaveLength(5);
		expect(sparks.every((s) => s.x === 10 && s.y === 20 && s.life === 1 && s.color === 2)).toBe(
			true
		);
	});

	it('stepSparks moves, pulls down and fades sparks, then drops dead ones', () => {
		const [spark] = burst(0, 0, 0, seq([0, 0]), 1); // angle 0, speed 0.6: moves right
		const [next] = stepSparks([spark]);
		expect(next.x).toBeCloseTo(0.6);
		expect(next.vy).toBeCloseTo(0.025);
		expect(next.life).toBeLessThan(1);
		let sparks = [spark];
		for (let i = 0; i < 100; i++) sparks = stepSparks(sparks);
		expect(sparks).toEqual([]);
	});

	it('does not mutate its input', () => {
		const sparks = burst(0, 0, 0, seq([0.3]), 2);
		const copy = structuredClone(sparks);
		stepSparks(sparks);
		expect(sparks).toEqual(copy);
	});
});
