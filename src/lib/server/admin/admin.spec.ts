import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { categories, categoryRules, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { seedStatements } from '../analytics/test-seed.ts';
import { buildDbXls, sampleRows } from '../importers/test-fixtures.ts';
import {
	activeCategories,
	createCategory,
	listCategories,
	setCategoryArchived,
	updateCategory
} from './categories.ts';
import { importUploads, listBatches, supportedImporters } from './imports.ts';
import {
	applySuggestion,
	assignCategory,
	defaultPattern,
	listUncategorised,
	suggestedRules
} from './review.ts';
import { createRule, deleteRule, listRules, moveRule, previewRule, reapplyAll } from './rules.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('admin');
	if (handle) {
		await seedStatements(handle.db, [
			{ date: '2026-02-01', concept: 'TARJETA-ZZQ WIDGETS 111', cents: -1000 },
			{ date: '2026-02-02', concept: 'TARJETA-ZZQ WIDGETS 222', cents: -2000 },
			{ date: '2026-02-03', concept: 'TARJETA-ZZQ WIDGETS 333', cents: -3000 },
			{ date: '2026-02-04', concept: 'TARJETA-QQX CAFE', cents: -400 },
			{ date: '2026-02-05', concept: 'TARJETA-QQX CAFE', cents: -500 },
			{ date: '2026-02-06', concept: 'TARJETA-LONELY SHOP', cents: -600 }
		]);
	}
});
afterAll(async () => {
	await handle?.pool.end();
});

const catId = async (h: DbHandle, slug: string) =>
	(await h.db.select().from(categories).where(eq(categories.slug, slug)))[0].id;

describe('defaultPattern', () => {
	it('derives the cleaned merchant from a concept', () => {
		expect(defaultPattern('TARJETA-ZZQ WIDGETS 111')).toBe('ZZQ WIDGETS');
		expect(defaultPattern('RECIBO ACME SERVICES 0001234')).toBe('ACME SERVICES');
	});
});

describe('review queue (needs local MySQL)', () => {
	it('lists newest first, paginates and searches', async (ctx) => {
		if (!handle) return ctx.skip();
		const all = await listUncategorised({ pageSize: 4 }, handle.db);
		expect(all.total).toBe(6);
		expect(all.rows).toHaveLength(4);
		expect(all.rows[0].bookingDate).toBe('2026-02-06');
		expect(all.rows[0].suggestedPattern).toBe('LONELY SHOP');
		const search = await listUncategorised({ search: 'zzq' }, handle.db);
		expect(search.total).toBe(3);
		expect((await listUncategorised({ search: '%' }, handle.db)).total).toBe(0);
	});

	it('suggests repeated merchants only', async (ctx) => {
		if (!handle) return ctx.skip();
		const s = await suggestedRules(10, handle.db);
		expect(s.map((x) => [x.merchant, x.count, x.totalCents])).toEqual([
			['ZZQ WIDGETS', 3, 6000],
			['QQX CAFE', 2, 900]
		]);
	});

	it('assigning with "also create a rule" categorises the other matching rows', async (ctx) => {
		if (!handle) return ctx.skip();
		const shopping = await catId(handle, 'shopping');
		const first = (await listUncategorised({ search: 'ZZQ' }, handle.db)).rows[0];
		const res = await assignCategory(
			{ statementId: first.id, categoryId: shopping, rulePattern: first.suggestedPattern },
			handle.db
		);
		expect(res.ok && res.value).toMatchObject({
			alsoCategorised: 2,
			rule: { pattern: 'ZZQ WIDGETS', created: true }
		});
		const rows = await handle.db
			.select()
			.from(statements)
			.where(eq(statements.categoryId, shopping));
		expect(rows.map((r) => r.categorySource).sort()).toEqual(['manual', 'rule', 'rule']);
		expect((await listUncategorised({}, handle.db)).total).toBe(3);
	});

	it('assigning without a rule touches only that row and rejects bad input', async (ctx) => {
		if (!handle) return ctx.skip();
		const food = await catId(handle, 'eating-out');
		const row = (await listUncategorised({ search: 'LONELY' }, handle.db)).rows[0];
		const res = await assignCategory({ statementId: row.id, categoryId: food }, handle.db);
		expect(res.ok && res.value).toMatchObject({ rule: null, alsoCategorised: 0 });
		const bad = await assignCategory(
			{ statementId: 1, categoryId: food, rulePattern: 'x' },
			handle.db
		);
		expect(bad.ok).toBe(false);
		expect((await assignCategory({ statementId: row.id, categoryId: 99999 }, handle.db)).ok).toBe(
			false
		);
		expect((await assignCategory({ statementId: 99999, categoryId: food }, handle.db)).ok).toBe(
			false
		);
	});

	it('a one-click suggestion creates the rule and reports the rows it categorised', async (ctx) => {
		if (!handle) return ctx.skip();
		const food = await catId(handle, 'eating-out');
		const res = await applySuggestion({ merchant: 'QQX CAFE', categoryId: food }, handle.db);
		expect(res.ok && res.value).toMatchObject({ categorised: 2, rule: { created: true } });
		const again = await applySuggestion({ merchant: 'QQX CAFE', categoryId: food }, handle.db);
		expect(again.ok && again.value.rule.created).toBe(false);
		expect((await listUncategorised({}, handle.db)).total).toBe(0);
	});
});

describe('categories (needs local MySQL)', () => {
	it('validates input', async (ctx) => {
		if (!handle) return ctx.skip();
		const res = await createCategory(
			{ name: '', color: 'teal', kind: 'x', sortOrder: 'a' },
			handle.db
		);
		expect(res.ok).toBe(false);
		if (!res.ok)
			expect(Object.keys(res.errors).sort()).toEqual(['color', 'kind', 'name', 'sortOrder']);
	});

	it('creates unique slugs, normalises colour and edits', async (ctx) => {
		if (!handle) return ctx.skip();
		const a = await createCategory(
			{ name: 'Café Corner', color: '#abc', kind: 'expense' },
			handle.db
		);
		const b = await createCategory(
			{ name: 'Cafe corner!', color: '#112233', kind: 'expense' },
			handle.db
		);
		expect(a.ok && a.value).toMatchObject({ slug: 'cafe-corner', color: '#AABBCC' });
		expect(b.ok && b.value.slug).toBe('cafe-corner-2');
		if (!a.ok) return;
		const edited = await updateCategory(
			a.value.id,
			{ name: 'Coffee', color: '#112233', kind: 'expense', sortOrder: '5' },
			handle.db
		);
		expect(edited.ok && edited.value).toMatchObject({
			name: 'Coffee',
			sortOrder: 5,
			slug: 'cafe-corner'
		});
	});

	it('archiving hides the category but keeps its statements and rules', async (ctx) => {
		if (!handle) return ctx.skip();
		const shopping = await catId(handle, 'shopping');
		const before = (await listCategories(handle.db)).find((c) => c.id === shopping);
		expect(before?.statementCount).toBe(3);
		expect(await setCategoryArchived(shopping, true, handle.db)).toBe(true);
		const after = (await listCategories(handle.db)).find((c) => c.id === shopping);
		expect(after).toMatchObject({ isActive: false, statementCount: 3 });
		expect((await activeCategories(handle.db)).some((c) => c.id === shopping)).toBe(false);
		const kept = await handle.db
			.select()
			.from(statements)
			.where(eq(statements.categoryId, shopping));
		expect(kept).toHaveLength(3);
		const ruleRows = await handle.db
			.select()
			.from(categoryRules)
			.where(eq(categoryRules.categoryId, shopping));
		expect(ruleRows.length).toBeGreaterThan(0);
		const blocked = await assignCategory(
			{ statementId: kept[0].id, categoryId: shopping },
			handle.db
		);
		expect(blocked.ok).toBe(false);
		await setCategoryArchived(shopping, false, handle.db);
		expect((await activeCategories(handle.db)).some((c) => c.id === shopping)).toBe(true);
	});
});

describe('rules (needs local MySQL)', () => {
	it('rejects invalid regex, duplicates and unknown categories', async (ctx) => {
		if (!handle) return ctx.skip();
		const cat = await catId(handle, 'health');
		const bad = await createRule(
			{ pattern: '(', matchType: 'regex', categoryId: String(cat) },
			handle.db
		);
		expect(!bad.ok && bad.errors.pattern).toMatch(/Invalid regular expression/);
		const ok = await createRule({ pattern: 'PHARMA TEST', categoryId: String(cat) }, handle.db);
		expect(ok.ok).toBe(true);
		const dup = await createRule({ pattern: 'PHARMA TEST', categoryId: String(cat) }, handle.db);
		expect(!dup.ok && dup.errors.pattern).toMatch(/already exists/);
		const unknown = await createRule({ pattern: 'NOPE', categoryId: '99999' }, handle.db);
		expect(!unknown.ok && unknown.errors.categoryId).toBeTruthy();
		const empty = await createRule({ pattern: ' ', categoryId: String(cat) }, handle.db);
		expect(empty.ok).toBe(false);
	});

	it('previews matches without changing anything', async (ctx) => {
		if (!handle) return ctx.skip();
		const res = await previewRule({ pattern: 'zzq widgets' }, handle.db);
		expect(res.ok && res.value.count).toBe(3);
		expect(res.ok && res.value.sample).toHaveLength(3);
		const out = await previewRule({ pattern: 'ZZQ', direction: 'in' }, handle.db);
		expect(out.ok && out.value.count).toBe(0);
		const bad = await previewRule({ pattern: '(', matchType: 'regex' }, handle.db);
		expect(bad.ok).toBe(false);
		const big = await previewRule({ pattern: 'TARJETA', matchType: 'contains' }, handle.db);
		expect(big.ok && big.value.sample.length).toBe(6);
		expect(big.ok && big.value.count).toBe(6);
	});

	it('moves rules up and down and keeps order stable', async (ctx) => {
		if (!handle) return ctx.skip();
		const before = await listRules(handle.db);
		const last = before[before.length - 1];
		expect(await moveRule(last.id, 'up', handle.db)).toBe(true);
		const after = await listRules(handle.db);
		expect(after[after.length - 2].id).toBe(last.id);
		expect(after[after.length - 1].id).toBe(before[before.length - 2].id);
		expect(await moveRule(after[0].id, 'up', handle.db)).toBe(false);
		expect(new Set(after.map((r) => r.priority)).size).toBe(after.length);
	});

	it('re-apply keeps manual categories and deletes work', async (ctx) => {
		if (!handle) return ctx.skip();
		const rule = (await listRules(handle.db)).find((r) => r.pattern === 'ZZQ WIDGETS');
		expect(rule).toBeTruthy();
		const result = await reapplyAll(handle.db);
		expect(result.matched).toBeGreaterThanOrEqual(2);
		const manual = await handle.db
			.select()
			.from(statements)
			.where(eq(statements.categorySource, 'manual'));
		expect(manual.length).toBeGreaterThanOrEqual(2);
		expect(await deleteRule(rule!.id, handle.db)).toBe(true);
		expect(await deleteRule(rule!.id, handle.db)).toBe(false);
	});
});

describe('imports (needs local MySQL)', () => {
	it('reports unsupported files without failing the others and dedups re-uploads', async (ctx) => {
		if (!handle) return ctx.skip();
		const good = buildDbXls(sampleRows);
		const files = [
			{ name: 'notes.txt', buffer: Buffer.from('hello') },
			{ name: 'empty.xls', buffer: Buffer.alloc(0) },
			{ name: 'a.xls', buffer: good }
		];
		const first = await importUploads(files, handle.db);
		expect(first[0]).toMatchObject({ ok: false, filename: 'notes.txt' });
		expect(first[1]).toMatchObject({ ok: false });
		expect(first[2].ok && first[2].summary.rowsInserted).toBe(3);
		const second = await importUploads([files[2]], handle.db);
		expect(second[0].ok && second[0].summary).toMatchObject({ rowsInserted: 0, rowsUnchanged: 3 });
		expect((await listBatches(10, handle.db)).length).toBeGreaterThanOrEqual(3);
		expect(supportedImporters().map((i) => i.id)).toContain('deutsche-bank-xls');
	});
});
