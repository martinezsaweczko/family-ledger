import { describe, expect, it } from 'vitest';
import { addDays, occurrences, todayIso, weekdayOf, type Schedule } from './schedule.ts';

const weekly = (over: Partial<Schedule> = {}): Schedule => ({
	frequency: 'weekly',
	anchor: 5, // Friday
	startDate: '2026-03-01',
	endDate: null,
	...over
});

describe('date helpers', () => {
	it('adds days across month and year boundaries', () => {
		expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
		expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});
	it('gives ISO weekdays (Mon=1 .. Sun=7)', () => {
		expect(weekdayOf('2026-03-06')).toBe(5); // Friday
		expect(weekdayOf('2026-03-08')).toBe(7); // Sunday
		expect(weekdayOf('2026-03-09')).toBe(1);
	});
	it('formats today from local parts', () => {
		expect(todayIso(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
	});
});

describe('occurrences', () => {
	it('weekly: every anchor weekday from the start date, inclusive range', () => {
		expect(occurrences(weekly(), '2026-03-01', '2026-03-31')).toEqual([
			'2026-03-06',
			'2026-03-13',
			'2026-03-20',
			'2026-03-27'
		]);
	});

	it('is stable regardless of the range window (no drift when started mid-way)', () => {
		const all = occurrences(weekly(), '2026-03-01', '2026-04-30');
		expect(occurrences(weekly(), '2026-03-14', '2026-04-30')).toEqual(
			all.filter((d) => d >= '2026-03-14')
		);
	});

	it('biweekly: every 14 days from the first matching weekday', () => {
		expect(occurrences(weekly({ frequency: 'biweekly' }), '2026-03-01', '2026-04-30')).toEqual([
			'2026-03-06',
			'2026-03-20',
			'2026-04-03',
			'2026-04-17'
		]);
	});

	it('monthly: day of month, clamped to the end of short months', () => {
		const s: Schedule = {
			frequency: 'monthly',
			anchor: 31,
			startDate: '2026-01-15',
			endDate: null
		};
		expect(occurrences(s, '2026-01-01', '2026-06-30')).toEqual([
			'2026-01-31',
			'2026-02-28',
			'2026-03-31',
			'2026-04-30',
			'2026-05-31',
			'2026-06-30'
		]);
		// leap year February
		expect(occurrences({ ...s, startDate: '2028-01-01' }, '2028-02-01', '2028-02-29')).toEqual([
			'2028-02-29'
		]);
	});

	it('monthly: never produces a date before the start date', () => {
		const s: Schedule = { frequency: 'monthly', anchor: 5, startDate: '2026-03-10', endDate: null };
		expect(occurrences(s, '2026-01-01', '2026-05-31')).toEqual(['2026-04-05', '2026-05-05']);
	});

	it('respects the end date (inclusive) and an empty window', () => {
		expect(occurrences(weekly({ endDate: '2026-03-13' }), '2026-03-01', '2026-12-31')).toEqual([
			'2026-03-06',
			'2026-03-13'
		]);
		expect(occurrences(weekly(), '2026-03-07', '2026-03-12')).toEqual([]);
		expect(occurrences(weekly(), '2026-04-01', '2026-03-01')).toEqual([]);
	});
});
