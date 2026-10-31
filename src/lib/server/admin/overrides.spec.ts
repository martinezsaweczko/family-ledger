import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq, isNull } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { categories, categoryRules, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { importFile } from '../importers/import-service.ts';
import { buildDbXls, type FakeRow } from '../importers/test-fixtures.ts';
import { recategorizeAll } from '../categorizer-service.ts';
import { seedStatements } from '../analytics/test-seed.ts';
import { changeCategory, clearOverride } from './overrides.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('overrides');
});
afterAll(async () => {
	await handle?.pool.end();
});

const catId = async (h: DbHandle, slug: string) =>
	(await h.db.select().from(categories).where(eq(categories.slug, slug)))[0].id;
const row = (n: number, concept: string, amount: number): FakeRow => ({
	date: `${String(n).padStart(2, '0')}/03/2026`,
	valueDate: `${String(n).padStart(2, '0')}/03/2026`,
	concept,
	amount,
	balance: 1000 - n
});
const base = [
	row(10, 'TARJETA-MERCADONA FAKE 1', -20),
	row(11, 'TARJETA-ZZQ WIDGETS 7', -5),
	row(12, 'RECIBO NETFLIX 000999', -12.99)
];
const superset = [row(13, 'TARJETA-MERCADONA FAKE 2', -30), ...base];
const total = async (h: DbHandle) => (await h.db.select({ n: count() }).from(statements))[0].n;

describe('manual override survives re-import (needs local MySQL)', () => {
	it('keeps the override through same-file and superset re-imports and recategorizeAll', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await importFile({ buffer: buildDbXls(base), filename: 'a.xls' }, h.db);
		expect(await total(h)).toBe(3);

		const [target] = await h.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-MERCADONA FAKE 1'));
		expect(target.categorySource).toBe('rule'); // rules put it in supermarket
		const shopping = await catId(h, 'shopping');
		const res = await changeCategory({ statementId: target.id, categoryId: shopping }, h.db);
		expect(res.ok).toBe(true);
		const snapshot = async () =>
			(await h.db.select().from(statements).where(eq(statements.id, target.id)))[0];
		const afterOverride = await snapshot();
		expect(afterOverride).toMatchObject({ categoryId: shopping, categorySource: 'manual' });

		const same = await importFile({ buffer: buildDbXls(base), filename: 'a2.xls' }, h.db);
		expect(same).toMatchObject({ rowsInserted: 0, rowsUnchanged: 3 });
		expect(await total(h)).toBe(3);
		expect(await snapshot()).toMatchObject({ categoryId: shopping, categorySource: 'manual' });

		const over = await importFile({ buffer: buildDbXls(superset), filename: 'b.xls' }, h.db);
		expect(over).toMatchObject({ rowsInserted: 1, rowsUnchanged: 3 });
		expect(await total(h)).toBe(4);
		expect(await snapshot()).toMatchObject({ categoryId: shopping, categorySource: 'manual' });

		await recategorizeAll(h.db);
		expect(await total(h)).toBe(4);
		expect(await snapshot()).toMatchObject({
			categoryId: shopping,
			categorySource: 'manual',
			amountCents: afterOverride.amountCents,
			bookingDate: afterOverride.bookingDate
		});
		// The sibling row without an override is still decided by rules.
		const [sibling] = await h.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-MERCADONA FAKE 2'));
		expect(sibling.categorySource).toBe('rule');
		expect(sibling.categoryId).toBe(await catId(h, 'supermarket'));
	});

	it('"Remove my change" hands the row back to the rules', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const [target] = await h.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-MERCADONA FAKE 1'));
		expect(target.categorySource).toBe('manual');
		const res = await clearOverride(target.id, h.db);
		expect(res).toMatchObject({ ok: true, value: { categoryId: await catId(h, 'supermarket') } });
		const [after] = await h.db.select().from(statements).where(eq(statements.id, target.id));
		expect(after.categorySource).toBe('rule');
		// Nothing left to clear.
		expect((await clearOverride(target.id, h.db)).ok).toBe(false);
		expect((await clearOverride(9_999_999, h.db)).ok).toBe(false);
	});

	it('clearing an override with no matching rule leaves the row uncategorised', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const [target] = await h.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-ZZQ WIDGETS 7'));
		await changeCategory({ statementId: target.id, categoryId: await catId(h, 'pets') }, h.db);
		const res = await clearOverride(target.id, h.db);
		expect(res).toMatchObject({ ok: true, value: { categoryId: null } });
		const [after] = await h.db.select().from(statements).where(eq(statements.id, target.id));
		expect(after).toMatchObject({ categoryId: null, categorySource: null });
	});

	it('validates the category and the statement', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const [any] = await h.db.select().from(statements).limit(1);
		const bad = await changeCategory({ statementId: any.id, categoryId: 9_999_999 }, h.db);
		expect(bad.ok).toBe(false);
		await h.db.update(categories).set({ isActive: false }).where(eq(categories.slug, 'travel'));
		const archived = await changeCategory(
			{ statementId: any.id, categoryId: await catId(h, 'travel') },
			h.db
		);
		expect(!archived.ok && archived.errors.categoryId).toMatch(/active/);
		await h.db.update(categories).set({ isActive: true }).where(eq(categories.slug, 'travel'));
		const missing = await changeCategory(
			{ statementId: 9_999_999, categoryId: await catId(h, 'travel') },
			h.db
		);
		expect(missing.ok).toBe(false);
	});

	it('with a rule, reports how many other rows changed and keeps the chosen row manual', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, [
			{ date: '2026-04-01', concept: 'TARJETA-QQX BAKERY 1', cents: -300 },
			{ date: '2026-04-02', concept: 'TARJETA-QQX BAKERY 2', cents: -400 },
			{ date: '2026-04-03', concept: 'TARJETA-QQX BAKERY 3', cents: -500 }
		]);
		const [target] = await h.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-QQX BAKERY 1'));
		const res = await changeCategory(
			{
				statementId: target.id,
				categoryId: await catId(h, 'eating-out'),
				rulePattern: 'QQX BAKERY'
			},
			h.db
		);
		expect(res.ok && res.value.rule?.created).toBe(true);
		// The target itself is already manual, so rules categorise the other two.
		expect(res.ok && res.value.alsoCategorised).toBe(2);
		expect(
			(await h.db.select().from(categoryRules).where(eq(categoryRules.pattern, 'QQX BAKERY')))
				.length
		).toBe(1);
		const uncategorised = await h.db
			.select({ n: count() })
			.from(statements)
			.where(isNull(statements.categoryId));
		expect(uncategorised[0].n).toBeGreaterThanOrEqual(1);
	});
});
