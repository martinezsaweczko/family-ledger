import { describe, expect, it } from 'vitest';
import { chartColor, contrast, hexToRgb, oklabDistance } from './color.ts';

const CARD_LIGHT = '#ffffff';
const CARD_DARK = '#111a2b';

// Same family as the seed categories / ColorPicker (mid and dark tones chosen for white).
const SWATCHES = [
	'#0F9488',
	'#E08A00',
	'#1D4ED8',
	'#4F5BD5',
	'#A21CAF',
	'#E11D48',
	'#DC2626',
	'#9A3412',
	'#CA8A04',
	'#3F6212',
	'#059669',
	'#475569'
];

describe('contrast', () => {
	it('matches the WCAG reference values', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
	});
	it('is symmetric', () => {
		expect(contrast('#0f9488', '#111a2b')).toBeCloseTo(contrast('#111a2b', '#0f9488'), 6);
	});
});

describe('chartColor', () => {
	it('leaves light-theme colours alone when they already contrast', () => {
		for (const hex of SWATCHES) {
			if (contrast(hex, CARD_LIGHT) >= 3) expect(chartColor(hex, 'light')).toBe(hex.toLowerCase());
		}
	});
	it('darkens light-theme colours that would vanish on white', () => {
		const out = chartColor('#ffee88', 'light');
		expect(contrast(out, CARD_LIGHT)).toBeGreaterThanOrEqual(3);
	});
	it('lifts every swatch to >= 3:1 on the dark card', () => {
		for (const hex of SWATCHES) {
			const out = chartColor(hex, 'dark');
			expect(contrast(out, CARD_DARK), `${hex} -> ${out}`).toBeGreaterThanOrEqual(3);
		}
	});
	it('keeps the hue family (channel order) when lifting', () => {
		const [r, g, b] = hexToRgb(chartColor('#1D4ED8', 'dark'));
		expect(b).toBeGreaterThan(r);
		expect(b).toBeGreaterThan(g);
	});
	it('keeps the swatches distinguishable in dark', () => {
		const out = SWATCHES.map((h) => chartColor(h, 'dark'));
		for (let i = 0; i < out.length; i++)
			for (let j = i + 1; j < out.length; j++)
				// 0.02 OKLab is the floor; the closest pairs (Rose/Red, Amber/Gold, Blue/Indigo) are near-twins in the stored light palette too.
				expect(
					oklabDistance(out[i], out[j]),
					`${SWATCHES[i]} vs ${SWATCHES[j]}`
				).toBeGreaterThanOrEqual(0.02);
	});
	it('is deterministic', () => {
		expect(chartColor('#4F5BD5', 'dark')).toBe(chartColor('#4F5BD5', 'dark'));
	});
	it('passes through values it cannot parse', () => {
		expect(chartColor('', 'dark')).toBe('');
		expect(chartColor('rebeccapurple', 'dark')).toBe('rebeccapurple');
	});
	it('accepts 3-digit hex', () => {
		expect(chartColor('#fff', 'light')).toMatch(/^#[0-9a-f]{6}$/);
	});
});
