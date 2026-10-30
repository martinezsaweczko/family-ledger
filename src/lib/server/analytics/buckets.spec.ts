import { describe, expect, it } from 'vitest';
import { bucketStart, generateBuckets, monthsSpan, previousPeriod } from './buckets.ts';

describe('buckets', () => {
	it('weeks start on Monday', () => {
		expect(bucketStart('2026-03-08', 'week')).toBe('2026-03-02'); // Sunday
		expect(bucketStart('2026-03-02', 'week')).toBe('2026-03-02');
	});

	it('generates month buckets across a year boundary without gaps', () => {
		expect(generateBuckets('2025-11-15', '2026-02-02', 'month')).toEqual([
			'2025-11-01',
			'2025-12-01',
			'2026-01-01',
			'2026-02-01'
		]);
	});

	it('generates days, weeks and years', () => {
		expect(generateBuckets('2026-03-01', '2026-03-03', 'day')).toHaveLength(3);
		expect(generateBuckets('2026-03-01', '2026-03-16', 'week')).toEqual([
			'2026-02-23',
			'2026-03-02',
			'2026-03-09',
			'2026-03-16'
		]);
		expect(generateBuckets('2024-06-01', '2026-01-01', 'year')).toEqual([
			'2024-01-01',
			'2025-01-01',
			'2026-01-01'
		]);
	});

	it('previous period has the same length and ends the day before', () => {
		expect(previousPeriod('2026-03-01', '2026-03-31')).toEqual({
			from: '2026-01-29',
			to: '2026-02-28'
		});
	});

	it('monthsSpan has a floor of one month', () => {
		expect(monthsSpan('2026-03-01', '2026-03-10')).toBe(1);
		expect(monthsSpan('2026-01-01', '2026-12-31')).toBeCloseTo(12, 0);
	});
});
