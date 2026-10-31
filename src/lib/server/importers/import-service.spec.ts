import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { importFile } from '#lib/server/importers/import-service.ts';
import { buildDbXls, sampleRows } from './test-fixtures.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('import');
}, 60_000);
afterAll(async () => {
	await handle?.pool.end();
});

const total = async (h: DbHandle) => (await h.db.select({ n: count() }).from(statements))[0].n;

describe('importFile (needs local MySQL)', () => {
	it('importing the same file twice inserts nothing the second time', async (ctx) => {
		if (!handle) return ctx.skip();
		const buffer = buildDbXls(sampleRows);
		const first = await importFile({ buffer, filename: 'a.xls' }, handle.db);
		expect(first).toMatchObject({
			rowsTotal: 3,
			rowsInserted: 3,
			rowsUpdated: 0,
			rowsUnchanged: 0
		});
		const second = await importFile({ buffer, filename: 'a.xls' }, handle.db);
		expect(second).toMatchObject({
			rowsTotal: 3,
			rowsInserted: 0,
			rowsUpdated: 0,
			rowsUnchanged: 3
		});
		expect(await total(handle)).toBe(3);
	});

	it('overlapping exports only insert the new rows', async (ctx) => {
		if (!handle) return ctx.skip();
		const extra = {
			date: '06/03/2026',
			valueDate: '06/03/2026',
			concept: 'NEW FAKE SHOP',
			amount: -5,
			balance: 995.5
		};
		const res = await importFile(
			{ buffer: buildDbXls([extra, ...sampleRows.slice(0, 2)]), filename: 'b.xls' },
			handle.db
		);
		expect(res).toMatchObject({ rowsInserted: 1, rowsUnchanged: 2 });
		expect(await total(handle)).toBe(4);
	});

	it('keeps identical same-day purchases distinct and never overwrites manual categories', async (ctx) => {
		if (!handle) return ctx.skip();
		const twin = {
			date: '07/03/2026',
			valueDate: '07/03/2026',
			concept: 'COFFEE',
			amount: -2,
			balance: 900
		};
		const buffer = buildDbXls([twin, { ...twin, balance: 898 }]);
		expect((await importFile({ buffer, filename: 'c.xls' }, handle.db)).rowsInserted).toBe(2);

		await handle.db
			.update(statements)
			.set({ categorySource: 'manual' })
			.where(eq(statements.concept, 'COFFEE'));
		await importFile({ buffer, filename: 'c.xls' }, handle.db);
		const rows = await handle.db.select().from(statements).where(eq(statements.concept, 'COFFEE'));
		expect(rows.every((r) => r.categorySource === 'manual')).toBe(true);
	});

	it('rejects unrecognised files with a clear error', async (ctx) => {
		if (!handle) return ctx.skip();
		await expect(
			importFile({ buffer: Buffer.from('nope'), filename: 'x.xls' }, handle.db)
		).rejects.toThrow(/recognise/);
	});
});
