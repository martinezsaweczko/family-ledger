import { describe, expect, it } from 'vitest';
import {
	formatDate,
	formatDateTime,
	formatDayMonth,
	formatMonthYear,
	isRealDate,
	maskDateInput,
	parseDate,
	toDisplayDate
} from './date.ts';

describe('formatDate', () => {
	it('writes full dates as dd/mm/yyyy', () => {
		expect(formatDate('2026-10-30')).toBe('30/10/2026');
		expect(formatDate('2026-01-05')).toBe('05/01/2026');
	});
	it('accepts a timestamp string and keeps garbage untouched', () => {
		expect(formatDate('2026-10-30 14:05:09')).toBe('30/10/2026');
		expect(formatDate('nope')).toBe('nope');
	});
});

describe('short labels', () => {
	it('uses dd/mm for day labels', () => {
		expect(formatDayMonth('2026-03-09')).toBe('09/03');
	});
	it('keeps English month names for month-only labels', () => {
		expect(formatMonthYear('2026-10-01')).toBe('Oct 2026');
		expect(formatMonthYear('2026-09-01')).toBe('Sep 2026');
		expect(formatMonthYear('2026-10-01', 'long')).toBe('October 2026');
	});
	it('formats date and time', () => {
		expect(formatDateTime('2026-10-30 14:05:09')).toBe('30/10/2026 14:05');
		expect(formatDateTime(new Date(2026, 9, 30, 9, 3))).toBe('30/10/2026 09:03');
	});
});

describe('isRealDate', () => {
	it('checks the calendar', () => {
		expect(isRealDate(2026, 2, 28)).toBe(true);
		expect(isRealDate(2024, 2, 29)).toBe(true);
		expect(isRealDate(2026, 2, 29)).toBe(false);
		expect(isRealDate(2026, 2, 31)).toBe(false);
		expect(isRealDate(2026, 13, 13)).toBe(false);
		expect(isRealDate(2026, 0, 10)).toBe(false);
	});
});

describe('parseDate', () => {
	it('accepts dd/mm/yyyy and ISO', () => {
		expect(parseDate('30/10/2026')).toBe('2026-10-30');
		expect(parseDate('2026-10-30')).toBe('2026-10-30');
		expect(parseDate(' 5/1/2026 ')).toBe('2026-01-05');
		expect(parseDate('05.01.2026')).toBe('2026-01-05');
		expect(parseDate('05-01-2026')).toBe('2026-01-05');
	});
	it('rejects impossible or malformed dates', () => {
		for (const bad of [
			'31/02/2026',
			'13/13/2026',
			'00/10/2026',
			'30/10/26',
			'2026-02-30',
			'30/10',
			'',
			'abc',
			'30/10/2026x'
		]) {
			expect(parseDate(bad), bad).toBeNull();
		}
		expect(parseDate(undefined)).toBeNull();
	});
	it('round-trips through the display format', () => {
		expect(parseDate(toDisplayDate('2024-02-29'))).toBe('2024-02-29');
		expect(toDisplayDate('')).toBe('');
	});
});

describe('maskDateInput', () => {
	it('inserts slashes while typing', () => {
		expect(maskDateInput('3')).toBe('3');
		expect(maskDateInput('30')).toBe('30/');
		expect(maskDateInput('301')).toBe('30/1');
		expect(maskDateInput('3010')).toBe('30/10/');
		expect(maskDateInput('30102026')).toBe('30/10/2026');
		expect(maskDateInput('301020261234')).toBe('30/10/2026');
	});
	it('pads a single digit when the user types a separator', () => {
		expect(maskDateInput('3/')).toBe('03/');
		expect(maskDateInput('3/1/')).toBe('03/01/');
		expect(maskDateInput('3.1.2026')).toBe('03/01/2026');
	});
	it('does not fight backspace', () => {
		expect(maskDateInput('30', true)).toBe('30');
		expect(maskDateInput('30/10', true)).toBe('30/10');
	});
	it('drops letters', () => {
		expect(maskDateInput('3a0')).toBe('30/');
	});
});
