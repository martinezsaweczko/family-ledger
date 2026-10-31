import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyInput, formatMoneyCompact, parseMoney } from './money.ts';
import { normalizeSpaces } from './space.ts';

const fmt = (cents: number) => normalizeSpaces(formatMoney(cents));

describe('formatMoney', () => {
	it('formats integer cents as 1.234,56 €', () => {
		expect(fmt(123456)).toBe('1.234,56 €');
	});
	it('groups 4-digit amounts too', () => {
		expect(fmt(100000)).toBe('1.000,00 €');
		expect(fmt(99999)).toBe('999,99 €');
		expect(fmt(123456789)).toBe('1.234.567,89 €');
	});
	it('formats negative amounts and zero', () => {
		expect(fmt(-500)).toBe('-5,00 €');
		expect(fmt(0)).toBe('0,00 €');
	});
});

describe('formatMoneyCompact', () => {
	it('shortens axis values', () => {
		expect(normalizeSpaces(formatMoneyCompact(34000))).toBe('340 €');
		expect(normalizeSpaces(formatMoneyCompact(120000))).toBe('1,2k €');
		expect(normalizeSpaces(formatMoneyCompact(-250000))).toBe('-2,5k €');
		expect(normalizeSpaces(formatMoneyCompact(200_000_000))).toBe('2M €');
	});
});

describe('formatMoneyInput', () => {
	it('uses a decimal comma and no grouping', () => {
		expect(formatMoneyInput(123456)).toBe('1234,56');
		expect(formatMoneyInput(4050)).toBe('40,50');
		expect(formatMoneyInput(-5)).toBe('-0,05');
	});
});

describe('parseMoney', () => {
	it('accepts comma and dot decimals', () => {
		expect(parseMoney('40')).toBe(4000);
		expect(parseMoney('40,50')).toBe(4050);
		expect(parseMoney('40.5')).toBe(4050);
		expect(parseMoney('40,5')).toBe(4050);
		expect(parseMoney('0,05')).toBe(5);
	});
	it('accepts thousands separators', () => {
		expect(parseMoney('1.234,56')).toBe(123456);
		expect(parseMoney('1.234')).toBe(123400);
		expect(parseMoney('1.234.567,89')).toBe(123456789);
		expect(parseMoney('1,234.56')).toBe(123456);
	});
	it('ignores spaces and the euro sign', () => {
		expect(parseMoney(' 1.234,56 €')).toBe(123456);
		expect(parseMoney('€40')).toBe(4000);
	});
	it('rejects garbage', () => {
		for (const bad of [
			'',
			'abc',
			'4O',
			'40,555',
			'1,234',
			'1..234',
			'12.34.56',
			'1.23,456',
			'40,',
			',5',
			'--5',
			'1e3',
			'0.500',
			'40 50'
		]) {
			expect(parseMoney(bad), bad).toBeNull();
		}
		expect(parseMoney(undefined)).toBeNull();
		expect(parseMoney(12)).toBeNull();
	});
	it('rejects negatives unless allowed', () => {
		expect(parseMoney('-5')).toBeNull();
		expect(parseMoney('-5,20', { allowNegative: true })).toBe(-520);
	});
	it('round-trips with formatMoneyInput', () => {
		for (const cents of [0, 5, 4050, 123456, 100000, 99999999]) {
			expect(parseMoney(formatMoneyInput(cents))).toBe(cents);
		}
		expect(parseMoney(formatMoneyInput(-1234), { allowNegative: true })).toBe(-1234);
	});
});
