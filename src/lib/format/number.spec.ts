import { describe, expect, it } from 'vitest';
import { formatDecimal, formatInteger, formatPercent } from './number.ts';
import { normalizeSpaces } from './space.ts';

describe('number formats', () => {
	it('groups integers with dots, always', () => {
		expect(formatInteger(1234)).toBe('1.234');
		expect(formatInteger(1234567)).toBe('1.234.567');
		expect(formatInteger(12)).toBe('12');
	});
	it('uses a decimal comma', () => {
		expect(formatDecimal(1234.5, 1)).toBe('1.234,5');
		expect(formatDecimal(0.25, 2)).toBe('0,25');
	});
	it('writes percentages as 12,5 %', () => {
		expect(normalizeSpaces(formatPercent(0.125, 1))).toBe('12,5 %');
		expect(normalizeSpaces(formatPercent(0.12))).toBe('12 %');
		expect(normalizeSpaces(formatPercent(0.12, 0, true))).toBe('+12 %');
		expect(normalizeSpaces(formatPercent(-0.05, 0, true))).toBe('-5 %');
		expect(normalizeSpaces(formatPercent(0, 0, true))).toBe('0 %');
	});
});
