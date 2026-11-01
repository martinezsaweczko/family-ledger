import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../db/index.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { dataset, seedStatements } from './test-seed.ts';
import {
	categoryBreakdown,
	categoryTrend,
	contributions,
	dataRange,
	recurring,
	summary,
	timeSeries,
	topMerchants,
	transactions
} from './index.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('analytics');
	if (handle) await seedStatements(handle.db, dataset);
}, 60_000);
afterAll(async () => {
	await handle?.pool.end();
});

const ALL = { from: '2026-01-01', to: '2026-04-30' };

describe('analytics (needs local MySQL)', () => {
	it('summary excludes transfers by default and reports spend as positive numbers', async (ctx) => {
		if (!handle) return ctx.skip();
		const s = await summary(ALL, handle.db);
		expect(s.incomeCents).toBe(900000);
		expect(s.expenseCents).toBe(10000 + 20000 + 30000 + 5000 + 4 * 1299 + 100);
		expect(s.netCents).toBe(s.incomeCents - s.expenseCents);
		expect(s.savingsRate).toBeCloseTo(s.netCents / s.incomeCents, 6);
		expect(s.count).toBe(14);
		const withTransfers = await summary({ ...ALL, includeTransfers: true }, handle.db);
		expect(withTransfers.expenseCents).toBe(s.expenseCents + 50000);
		expect(withTransfers.count).toBe(15);
	});

	it('latest balance comes from the newest day, first-listed row of that day', async (ctx) => {
		if (!handle) return ctx.skip();
		const s = await summary(ALL, handle.db);
		expect(s.latestBalanceCents).toBe(777700);
		expect(s.latestBalanceDate).toBe('2026-04-14');
		const early = await summary({ from: '2026-01-01', to: '2026-01-31' }, handle.db);
		expect(early.latestBalanceCents).toBe(650000);
	});

	it('compares with the previous period of equal length', async (ctx) => {
		if (!handle) return ctx.skip();
		const s = await summary({ from: '2026-03-01', to: '2026-03-31' }, handle.db);
		expect(s.incomeCents).toBe(200000);
		expect(s.expenseCents).toBe(30000 + 5000 + 1299);
		// previous = 2026-01-29 .. 2026-02-28
		expect(s.previous).toMatchObject({ incomeCents: 350000, expenseCents: 21299 });
		expect(s.delta?.incomeCents).toBe(-150000);
		expect(s.delta?.incomePct).toBeCloseTo(-150000 / 350000, 6);
		expect(s.delta?.expenseCents).toBe(36299 - 21299);
		const open = await summary({ from: '2026-03-01' }, handle.db);
		expect(open.previous).toBeNull();
	});

	it('timeSeries zero-fills empty buckets', async (ctx) => {
		if (!handle) return ctx.skip();
		const ts = await timeSeries({ from: '2025-12-01', to: '2026-05-31' }, 'month', handle.db);
		expect(ts.map((b) => b.bucket)).toEqual([
			'2025-12-01',
			'2026-01-01',
			'2026-02-01',
			'2026-03-01',
			'2026-04-01',
			'2026-05-01'
		]);
		expect(ts[0]).toMatchObject({ incomeCents: 0, expenseCents: 0, netCents: 0 });
		expect(ts[1]).toMatchObject({ incomeCents: 350000, expenseCents: 11299 });
		expect(ts[5]).toMatchObject({ incomeCents: 0, expenseCents: 0 });
		const days = await timeSeries({ from: '2026-03-01', to: '2026-03-07' }, 'day', handle.db);
		expect(days).toHaveLength(7);
		expect(days[4]).toMatchObject({ bucket: '2026-03-05', expenseCents: 30000 });
		const years = await timeSeries({}, 'year', handle.db);
		expect(years).toHaveLength(1);
	});

	it('categoryBreakdown separates income and expense with shares and monthly averages', async (ctx) => {
		if (!handle) return ctx.skip();
		const b = await categoryBreakdown({ from: '2026-01-01', to: '2026-03-31' }, handle.db);
		const supermarket = b.expense.find((r) => r.slug === 'supermarket');
		expect(supermarket).toMatchObject({ totalCents: 60000, count: 3 });
		expect(supermarket?.avgPerMonthCents).toBeGreaterThan(19000);
		expect(supermarket?.avgPerMonthCents).toBeLessThan(21000);
		const expenseTotal = b.expense.reduce((n, r) => n + r.totalCents, 0);
		expect(supermarket?.sharePct).toBeCloseTo((60000 / expenseTotal) * 100, 4);
		expect(b.expense.some((r) => r.categoryId === null && r.totalCents === 5000)).toBe(true);
		expect(b.income.map((r) => r.slug)).toEqual(['salary-contributions']);
		expect(b.expense.some((r) => r.slug === 'internal-transfer')).toBe(false);
		expect(b.expense[0].totalCents).toBeGreaterThanOrEqual(b.expense[1].totalCents);
	});

	it('categoryTrend keeps top N and groups the rest into Other', async (ctx) => {
		if (!handle) return ctx.skip();
		const t = await categoryTrend({ from: '2026-01-01', to: '2026-04-30' }, 'month', 1, handle.db);
		expect(t.buckets).toHaveLength(4);
		expect(t.series.map((s) => s.name)).toEqual(['Supermarket', 'Other']);
		expect(t.series[0].values).toEqual([10000, 20000, 30000, 0]);
		const other = t.series[1].values;
		expect(other).toEqual([1299, 1299, 5000 + 1299, 1299 + 100]);
	});

	it('contributions split salary income by person per bucket', async (ctx) => {
		if (!handle) return ctx.skip();
		const c = await contributions(ALL, 'month', handle.db);
		const david = c.people.find((p) => p.name === 'David');
		const joanna = c.people.find((p) => p.name === 'Joanna');
		expect(david).toMatchObject({ totalCents: 600000 });
		expect(joanna).toMatchObject({ totalCents: 300000 });
		expect(david?.values).toEqual([200000, 200000, 200000, 0]);
		expect(joanna?.values).toEqual([150000, 150000, 0, 0]);
		expect(david?.sharePct).toBeCloseTo(66.6667, 3);
		expect(c.people.reduce((n, p) => n + p.sharePct, 0)).toBeCloseTo(100, 6);
		const onlyJoanna = await contributions(
			{ ...ALL, personId: joanna?.personId ?? undefined },
			'month',
			handle.db
		);
		expect(onlyJoanna.people.map((p) => p.name)).toEqual(['Joanna']);
	});

	it('topMerchants merges normalised names', async (ctx) => {
		if (!handle) return ctx.skip();
		const m = await topMerchants(ALL, 3, handle.db);
		expect(m).toHaveLength(3);
		expect(m[0]).toMatchObject({ merchant: 'MERCADONA PORT', totalCents: 60000, count: 3 });
		expect(m[0].avgCents).toBe(20000);
		expect(m[1]).toMatchObject({ merchant: 'NETFLIX', totalCents: 4 * 1299, count: 4 });
		expect(m[2].merchant).toBe('UNKNOWN SHOP');
	});

	it('recurring finds the monthly subscription and ignores irregular spend', async (ctx) => {
		if (!handle) return ctx.skip();
		const r = await recurring(ALL, handle.db);
		expect(r.map((x) => x.merchant)).toEqual(['NETFLIX']);
		expect(r[0]).toMatchObject({
			occurrences: 4,
			estimatedMonthlyCents: 1299,
			lastDate: '2026-04-14'
		});
	});

	it('transactions paginates, searches and sorts', async (ctx) => {
		if (!handle) return ctx.skip();
		const p1 = await transactions(ALL, { page: 1, pageSize: 5 }, handle.db);
		expect(p1.total).toBe(14);
		expect(p1.rows).toHaveLength(5);
		expect(p1.rows[0].bookingDate >= p1.rows[4].bookingDate).toBe(true);
		const p3 = await transactions(ALL, { page: 3, pageSize: 5 }, handle.db);
		expect(p3.rows).toHaveLength(4);
		const search = await transactions(ALL, { search: 'netflix', pageSize: 10 }, handle.db);
		expect(search.total).toBe(4);
		const big = await transactions(ALL, { sort: 'amount_asc', pageSize: 1 }, handle.db);
		expect(big.rows[0].amountCents).toBe(-30000);
		expect(big.rows[0].categoryName).toBe('Supermarket');
		const wild = await transactions(ALL, { search: '100%' }, handle.db);
		expect(wild.total).toBe(0);
	});

	it('dataRange reports min/max and counts', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await dataRange(handle.db)).toMatchObject({
			minDate: '2026-01-02',
			maxDate: '2026-04-14',
			count: 15,
			uncategorisedCount: 1
		});
	});
});
