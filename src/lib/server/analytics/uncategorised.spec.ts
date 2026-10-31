import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { dataset, seedStatements } from './test-seed.ts';
import { categoryBreakdown, countUncategorised, summary, transactions } from './index.ts';

let handle: DbHandle | null = null;
const ALL = { from: '2026-01-01', to: '2026-04-30' };

beforeAll(async () => {
	handle = await setupTestDb('uncategorised');
	if (!handle) return;
	await seedStatements(handle.db, [
		...dataset, // one uncategorised row: TARJETA-UNKNOWN SHOP, -50,00 on 2026-03-07
		{ date: '2026-03-08', concept: 'TRF.EX MYSTERY REFUND', cents: 2500 }, // uncategorised, positive
		{ date: '2026-03-09', concept: 'TARJETA-AI GUESS SHOP', cents: -700, category: 'shopping' }
	]);
	const { db } = handle;
	const [shopping] = await db.select().from(categories).where(eq(categories.slug, 'shopping'));
	// AI-assigned: the guess; my edit: the Mercadona row of January; manual entry: one new row.
	await db
		.update(statements)
		.set({ categorySource: 'ai', aiConfidence: 80, aiModel: 'stub' })
		.where(eq(statements.concept, 'TARJETA-AI GUESS SHOP'));
	await db
		.update(statements)
		.set({ categorySource: 'manual' })
		.where(eq(statements.concept, 'TARJETA-MERCADONA PORT'));
	await db
		.update(statements)
		.set({ importerId: 'manual', categoryId: shopping.id, categorySource: 'manual' })
		.where(eq(statements.concept, 'TARJETA-OTHER SAME DAY'));
}, 60_000);
afterAll(async () => {
	await handle?.pool.end();
});

const concepts = async (f: Parameters<typeof transactions>[0]) =>
	(await transactions(f, { pageSize: 100 }, handle!.db)).rows.map((r) => r.concept).sort();

describe('uncategorised filter (needs local MySQL)', () => {
	it('on its own it selects only rows without a category', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await concepts({ ...ALL, includeUncategorised: true })).toEqual([
			'TARJETA-UNKNOWN SHOP',
			'TRF.EX MYSTERY REFUND'
		]);
	});

	it('combines with chosen categories as OR', async (ctx) => {
		if (!handle) return ctx.skip();
		const [subs] = await handle.db
			.select()
			.from(categories)
			.where(eq(categories.slug, 'subscriptions'));
		const rows = await concepts({ ...ALL, categoryIds: [subs.id], includeUncategorised: true });
		expect(rows).toHaveLength(2 + 4);
		expect(rows.filter((c) => c.startsWith('RECIBO NETFLIX'))).toHaveLength(4);
		expect(rows).toContain('TARJETA-UNKNOWN SHOP');
		// without the flag the old behaviour is unchanged: only the chosen category
		expect(await concepts({ ...ALL, categoryIds: [subs.id] })).toHaveLength(4);
	});

	it('counts uncategorised rows for the badge, ignoring category and source selections', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await countUncategorised(ALL, '', handle.db)).toBe(2);
		expect(
			await countUncategorised({ ...ALL, source: 'ai', categoryIds: [1] }, '', handle.db)
		).toBe(2);
		expect(await countUncategorised(ALL, 'mystery', handle.db)).toBe(1);
		expect(await countUncategorised({ from: '2026-01-01', to: '2026-02-28' }, '', handle.db)).toBe(
			0
		);
	});

	it('keeps totals consistent: uncategorised rows are counted once, in their own bucket', async (ctx) => {
		if (!handle) return ctx.skip();
		const all = await summary(ALL, handle.db);
		const only = await summary({ ...ALL, includeUncategorised: true }, handle.db);
		expect(only.count).toBe(2);
		expect(only.expenseCents).toBe(5000);
		expect(only.incomeCents).toBe(2500); // no income/expense category: the sign decides
		// every row is in the total: categorised + uncategorised = all
		const categorised = await summary(
			{ ...ALL, categoryIds: (await handle.db.select().from(categories)).map((c) => c.id) },
			handle.db
		);
		expect(categorised.count + only.count).toBe(all.count);
		expect(categorised.expenseCents + only.expenseCents).toBe(all.expenseCents);
		expect(categorised.incomeCents + only.incomeCents).toBe(all.incomeCents);
	});

	it('shows an Uncategorised bucket in the breakdown so nothing is silently dropped', async (ctx) => {
		if (!handle) return ctx.skip();
		const [b, s] = await Promise.all([categoryBreakdown(ALL, handle.db), summary(ALL, handle.db)]);
		const gap = b.expense.find((c) => c.categoryId === null)!;
		expect(gap).toMatchObject({ name: 'Uncategorised', totalCents: 5000, count: 1, slug: null });
		expect(b.income.find((c) => c.categoryId === null)).toMatchObject({
			totalCents: 2500,
			count: 1
		});
		const sum = (xs: { totalCents: number }[]) => xs.reduce((n, c) => n + c.totalCents, 0);
		expect(sum(b.expense)).toBe(s.expenseCents);
		expect(sum(b.income)).toBe(s.incomeCents);
		// and filtered to uncategorised only, the breakdown is just that bucket
		const only = await categoryBreakdown({ ...ALL, includeUncategorised: true }, handle.db);
		expect(only.expense.map((c) => c.categoryId)).toEqual([null]);
	});
});

describe('source filter (needs local MySQL)', () => {
	const by = (source: Parameters<typeof concepts>[0]['source']) => concepts({ ...ALL, source });

	it('attention = uncategorised + AI suggestions', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await by('attention')).toEqual([
			'TARJETA-AI GUESS SHOP',
			'TARJETA-UNKNOWN SHOP',
			'TRF.EX MYSTERY REFUND'
		]);
	});
	it('ai, rule, mine, manual and imported', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await by('ai')).toEqual(['TARJETA-AI GUESS SHOP']);
		expect(await by('mine')).toEqual(['TARJETA-MERCADONA PORT']); // not the manual entry
		expect(await by('manual')).toEqual(['TARJETA-OTHER SAME DAY']);
		expect((await by('imported')).includes('TARJETA-OTHER SAME DAY')).toBe(false);
		expect((await by('imported')).length).toBe((await by('any')).length - 1);
		const rule = await by('rule');
		expect(rule).not.toContain('TARJETA-AI GUESS SHOP');
		expect(rule).not.toContain('TARJETA-UNKNOWN SHOP');
		expect(rule).toContain('RECIBO NETFLIX 000111');
	});
	it('is ANDed with the category selection and with the uncategorised flag', async (ctx) => {
		if (!handle) return ctx.skip();
		expect(await concepts({ ...ALL, includeUncategorised: true, source: 'ai' })).toEqual([]);
		expect(await concepts({ ...ALL, includeUncategorised: true, source: 'attention' })).toEqual([
			'TARJETA-UNKNOWN SHOP',
			'TRF.EX MYSTERY REFUND'
		]);
		const [shopping] = await handle.db
			.select()
			.from(categories)
			.where(eq(categories.slug, 'shopping'));
		expect(await concepts({ ...ALL, categoryIds: [shopping.id], source: 'ai' })).toEqual([
			'TARJETA-AI GUESS SHOP'
		]);
	});
	it('affects totals the same way as the list (summary count equals list total)', async (ctx) => {
		if (!handle) return ctx.skip();
		for (const source of ['attention', 'ai', 'rule', 'mine', 'manual', 'imported'] as const) {
			const f = { ...ALL, source };
			const list = await transactions(f, { pageSize: 100 }, handle.db);
			expect((await summary(f, handle.db)).count).toBe(list.total);
		}
	});
});
