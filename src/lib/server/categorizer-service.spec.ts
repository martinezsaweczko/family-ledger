import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from './db/index.ts';
import { categories, statements } from './db/schema.ts';
import { setupTestDb } from './testing/test-db.ts';
import { recategorizeAll } from './categorizer-service.ts';
import { importFile } from './importers/import-service.ts';
import { buildDbXls } from './importers/test-fixtures.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('categorizer');
});
afterAll(async () => {
	await handle?.pool.end();
});

const slugOf = async (h: DbHandle, concept: string) => {
	const [row] = await h.db
		.select({ slug: categories.slug, source: statements.categorySource })
		.from(statements)
		.leftJoin(categories, eq(categories.id, statements.categoryId))
		.where(eq(statements.concept, concept));
	return row;
};

describe('categorisation (needs local MySQL)', () => {
	it('categorises new rows on import, leaves unknown ones null, keeps manual ones on recategorize', async (ctx) => {
		if (!handle) return ctx.skip();
		const rows = [
			{
				date: '01/03/2026',
				valueDate: '01/03/2026',
				concept: 'COMPRA MERCADONA X',
				amount: -10,
				balance: 100
			},
			{
				date: '01/03/2026',
				valueDate: '01/03/2026',
				concept: 'UNKNOWN SHOP',
				amount: -5,
				balance: 95
			},
			{
				date: '02/03/2026',
				valueDate: '02/03/2026',
				concept: 'COMPRA LIDL Y',
				amount: -7,
				balance: 88
			}
		];
		await importFile({ buffer: buildDbXls(rows), filename: 'a.xls' }, handle.db);
		expect(await slugOf(handle, 'COMPRA MERCADONA X')).toEqual({
			slug: 'supermarket',
			source: 'rule'
		});
		expect((await slugOf(handle, 'UNKNOWN SHOP')).slug).toBeNull();

		const [shopping] = await handle.db
			.select()
			.from(categories)
			.where(eq(categories.slug, 'shopping'));
		await handle.db
			.update(statements)
			.set({ categoryId: shopping.id, categorySource: 'manual' })
			.where(eq(statements.concept, 'COMPRA LIDL Y'));

		const result = await recategorizeAll(handle.db);
		expect(result.matched).toBe(1);
		expect(await slugOf(handle, 'COMPRA LIDL Y')).toEqual({ slug: 'shopping', source: 'manual' });
		// re-import must not touch the manual category either
		await importFile({ buffer: buildDbXls(rows), filename: 'a.xls' }, handle.db);
		expect(await slugOf(handle, 'COMPRA LIDL Y')).toEqual({ slug: 'shopping', source: 'manual' });
	});
});
