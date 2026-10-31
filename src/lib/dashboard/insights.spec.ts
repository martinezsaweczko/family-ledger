import { describe, expect, it } from 'vitest';
import { normalizeSpaces } from '#lib/format/space.ts';
import {
	balanceInsight,
	changeInsight,
	contributionInsight,
	formatBucket,
	kpiDelta,
	recurringInsight,
	topCategoryInsight
} from './insights.ts';

const n = (s: string | null) => normalizeSpaces(s ?? '');

describe('kpiDelta', () => {
	it('marks rising income as good and rising expenses as bad, with arrow text', () => {
		expect(kpiDelta(0.12, 'up')).toMatchObject({ dir: 'up', tone: 'good', text: '+12\u00a0%' });
		expect(kpiDelta(0.12, 'down')).toMatchObject({ dir: 'up', tone: 'bad', text: '+12\u00a0%' });
		expect(kpiDelta(-0.05, 'down')).toMatchObject({ dir: 'down', tone: 'good', text: '-5\u00a0%' });
	});
	it('is neutral for flat or unknown changes', () => {
		expect(kpiDelta(0.001, 'up')).toMatchObject({ dir: 'flat', tone: 'neutral' });
		expect(kpiDelta(null, 'up')).toMatchObject({ dir: 'none', tone: 'neutral', text: 'n/a' });
	});
});

describe('insight sentences', () => {
	it('describes the change against the previous period', () => {
		expect(n(changeInsight('Expenses', 0.123))).toBe(
			'Expenses are 12 % higher than the previous period.'
		);
		expect(n(changeInsight('Income', -0.4))).toBe('Income is 40 % lower than the previous period.');
		expect(changeInsight('Income', 0.004)).toBe('Income is flat versus the previous period.');
		expect(changeInsight('Income', null)).toBeNull();
	});
	it('names the top spending category and its share', () => {
		expect(n(topCategoryInsight([{ name: 'Supermarket', sharePct: 34.4 }]))).toBe(
			'Supermarket is the largest expense at 34 % of spending.'
		);
		expect(topCategoryInsight([])).toBeNull();
	});
	it('states who contributes what share', () => {
		expect(
			n(
				contributionInsight([
					{ name: 'David', sharePct: 57.3 },
					{ name: 'Joanna', sharePct: 42.7 }
				])
			)
		).toBe('David contributes 57 % of household income, Joanna 43 %.');
		expect(n(contributionInsight([{ name: 'David', sharePct: 100 }]))).toBe(
			'David contributes 100 % of household income.'
		);
		expect(contributionInsight([])).toBeNull();
	});
	it('sums the recurring commitment', () => {
		expect(n(recurringInsight(3, 12345))).toBe(
			'3 recurring charges commit about 123,45 € a month.'
		);
		expect(n(recurringInsight(1, 1299))).toBe('1 recurring charge commits about 12,99 € a month.');
		expect(recurringInsight(0, 0)).toBeNull();
	});
	it('reports balance movement across the range', () => {
		expect(n(balanceInsight(100000, 150000))).toBe('Balance is up 500,00 € over the period.');
		expect(n(balanceInsight(150000, 100000))).toBe('Balance is down 500,00 € over the period.');
		expect(balanceInsight(null, 1)).toBeNull();
	});
});

describe('formatBucket', () => {
	it('labels buckets by granularity', () => {
		expect(formatBucket('2026-03-12', 'day')).toBe('12/03');
		expect(formatBucket('2026-03-09', 'week')).toBe('09/03');
		expect(formatBucket('2026-03-01', 'month')).toBe('Mar 2026');
		expect(formatBucket('2026-01-01', 'year')).toBe('2026');
	});
});
