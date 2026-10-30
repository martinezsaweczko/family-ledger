import { describe, expect, it } from 'vitest';
import {
	balanceInsight,
	changeInsight,
	contributionInsight,
	formatBucket,
	kpiDelta,
	recurringInsight,
	topCategoryInsight
} from './insights.ts';

describe('kpiDelta', () => {
	it('marks rising income as good and rising expenses as bad, with arrow text', () => {
		expect(kpiDelta(0.12, 'up')).toMatchObject({ dir: 'up', tone: 'good', text: '+12%' });
		expect(kpiDelta(0.12, 'down')).toMatchObject({ dir: 'up', tone: 'bad', text: '+12%' });
		expect(kpiDelta(-0.05, 'down')).toMatchObject({ dir: 'down', tone: 'good', text: '-5%' });
	});
	it('is neutral for flat or unknown changes', () => {
		expect(kpiDelta(0.001, 'up')).toMatchObject({ dir: 'flat', tone: 'neutral' });
		expect(kpiDelta(null, 'up')).toMatchObject({ dir: 'none', tone: 'neutral', text: 'n/a' });
	});
});

describe('insight sentences', () => {
	it('describes the change against the previous period', () => {
		expect(changeInsight('Expenses', 0.123)).toBe(
			'Expenses are 12% higher than the previous period.'
		);
		expect(changeInsight('Income', -0.4)).toBe('Income is 40% lower than the previous period.');
		expect(changeInsight('Income', 0.004)).toBe('Income is flat versus the previous period.');
		expect(changeInsight('Income', null)).toBeNull();
	});
	it('names the top spending category and its share', () => {
		expect(topCategoryInsight([{ name: 'Supermarket', sharePct: 34.4 }])).toBe(
			'Supermarket is the largest expense at 34% of spending.'
		);
		expect(topCategoryInsight([])).toBeNull();
	});
	it('states who contributes what share', () => {
		expect(
			contributionInsight([
				{ name: 'David', sharePct: 57.3 },
				{ name: 'Joanna', sharePct: 42.7 }
			])
		).toBe('David contributes 57% of household income, Joanna 43%.');
		expect(contributionInsight([{ name: 'David', sharePct: 100 }])).toBe(
			'David contributes 100% of household income.'
		);
		expect(contributionInsight([])).toBeNull();
	});
	it('sums the recurring commitment', () => {
		expect(recurringInsight(3, 12345)).toBe('3 recurring charges commit about €123.45 a month.');
		expect(recurringInsight(1, 1299)).toBe('1 recurring charge commits about €12.99 a month.');
		expect(recurringInsight(0, 0)).toBeNull();
	});
	it('reports balance movement across the range', () => {
		expect(balanceInsight(100000, 150000)).toBe('Balance is up €500.00 over the period.');
		expect(balanceInsight(150000, 100000)).toBe('Balance is down €500.00 over the period.');
		expect(balanceInsight(null, 1)).toBeNull();
	});
});

describe('formatBucket', () => {
	it('labels buckets by granularity', () => {
		expect(formatBucket('2026-03-12', 'day')).toBe('12 Mar');
		expect(formatBucket('2026-03-09', 'week')).toBe('9 Mar');
		expect(formatBucket('2026-03-01', 'month')).toBe('Mar 26');
		expect(formatBucket('2026-01-01', 'year')).toBe('2026');
	});
});
