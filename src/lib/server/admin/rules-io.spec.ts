import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { categories, categoryRules, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { seedStatements } from '../analytics/test-seed.ts';
import { createRule } from './rules.ts';
import { confirmImport, exportRules, exportRulesJson, previewImport } from './rules-io.ts';

let src: DbHandle | null = null;
let dst: DbHandle | null = null;
beforeAll(async () => {
	src = await setupTestDb('rulesio_src');
	dst = await setupTestDb('rulesio_dst');
	if (src) {
		await seedStatements(src.db, [
			{ date: '2026-02-01', concept: 'TARJETA-ZZQ WIDGETS 111', cents: -1000 },
			{ date: '2026-02-02', concept: 'TARJETA-MERCADONA 1', cents: -2000, category: 'supermarket' }
		]);
	}
}, 120_000);
afterAll(async () => {
	await src?.pool.end();
	await dst?.pool.end();
});

const emptyRulesAndCategories = async (h: DbHandle) => {
	await h.db.delete(categoryRules);
	await h.db.delete(categories);
};
const rulesOf = async (h: DbHandle) =>
	(await exportRules({}, h.db)).rules.map(
		({ pattern, matchType, direction, categorySlug, person, priority, isActive }) => ({
			pattern,
			matchType,
			direction,
			categorySlug,
			person,
			priority,
			isActive
		})
	);

describe('export (needs local MySQL)', () => {
	it('has a versioned id-free shape and no statement data', async (ctx) => {
		if (!src) return ctx.skip();
		const text = await exportRulesJson({ now: new Date('2026-05-01T10:00:00Z') }, src.db);
		const data = JSON.parse(text);
		expect(Object.keys(data)).toEqual(['format', 'version', 'exportedAt', 'categories', 'rules']);
		expect(data).toMatchObject({
			format: 'hearth.rules',
			version: 1,
			exportedAt: '2026-05-01T10:00:00.000Z'
		});
		expect(data.rules.length).toBeGreaterThan(10);
		expect(text).not.toMatch(/"(id|categoryId|personId|iban|amount)/i);
		expect(text).not.toContain('ZZQ WIDGETS');
		expect(text).not.toContain('ES00000000');
		const slugs = new Set(data.rules.map((r: { categorySlug: string }) => r.categorySlug));
		expect(data.categories.map((c: { slug: string }) => c.slug).sort()).toEqual([...slugs].sort());
	});
	it('can restrict to active rules and include every category', async (ctx) => {
		if (!src) return ctx.skip();
		const [first] = await src.db.select().from(categoryRules).limit(1);
		await src.db
			.update(categoryRules)
			.set({ isActive: false })
			.where(eq(categoryRules.id, first.id));
		const all = await exportRules({}, src.db);
		const active = await exportRules({ onlyActive: true }, src.db);
		expect(active.rules).toHaveLength(all.rules.length - 1);
		const full = await exportRules({ allCategories: true }, src.db);
		expect(full.categories.length).toBe((await src.db.select().from(categories)).length);
		await src.db
			.update(categoryRules)
			.set({ isActive: true })
			.where(eq(categoryRules.id, first.id));
	});
});

describe('import (needs local MySQL)', () => {
	it('round-trips export -> import into an empty database, then is idempotent', async (ctx) => {
		if (!src || !dst) return ctx.skip();
		await emptyRulesAndCategories(dst);
		const text = await exportRulesJson({}, src.db);
		const preview = await previewImport(text, dst.db);
		if (!preview.ok) throw new Error(preview.error);
		expect(preview.plan.missingCategory.length).toBe((await rulesOf(src)).length);
		expect(preview.plan.invalid).toEqual([]);

		const first = await confirmImport(preview.payload, {}, dst.db);
		if (!first.ok) throw new Error(first.error);
		expect(first.result.createdRules).toBe((await rulesOf(src)).length);
		expect(first.result.categoriesCreated).toBeGreaterThan(0);
		expect(await rulesOf(dst)).toEqual(await rulesOf(src));
		expect((await exportRules({}, dst.db)).categories).toEqual(
			(await exportRules({}, src.db)).categories
		);

		// Later tests need the rest of the seeded categories too.
		const have = new Set((await dst.db.select().from(categories)).map((c) => c.slug));
		const rest = (await src.db.select().from(categories)).filter((c) => !have.has(c.slug));
		if (rest.length)
			await dst.db.insert(categories).values(rest.map((c) => ({ ...c, id: undefined })));

		const again = await previewImport(text, dst.db);
		if (!again.ok) throw new Error(again.error);
		expect(again.plan.newRules).toHaveLength(0);
		expect(again.plan.identical.length).toBe(first.result.createdRules);
		const second = await confirmImport(again.payload, {}, dst.db);
		expect(second).toMatchObject({
			ok: true,
			result: { createdRules: 0, updatedRules: 0, categoriesCreated: 0 }
		});
	});

	it('keeps mine by default and uses the imported version on request', async (ctx) => {
		if (!dst) return ctx.skip();
		const doc = (category: string, direction = 'in') =>
			JSON.stringify({
				format: 'hearth.rules',
				version: 1,
				categories: [],
				rules: [
					{
						pattern: 'ZZQ CONFLICT',
						matchType: 'contains',
						direction,
						categorySlug: category,
						person: 'David',
						priority: 4242,
						isActive: false
					}
				]
			});
		const [shopping] = await dst.db
			.select()
			.from(categories)
			.where(eq(categories.slug, 'shopping'));
		await createRule(
			{ pattern: 'ZZQ CONFLICT', categoryId: String(shopping.id), priority: '77' },
			dst.db
		);

		const p = await previewImport(doc('supermarket'), dst.db);
		if (!p.ok) throw new Error(p.error);
		expect(p.plan.conflicts).toHaveLength(1);
		expect(p.plan.conflicts[0].differences).toHaveLength(4);

		const keep = await confirmImport(p.payload, { reapply: false }, dst.db);
		expect(keep).toMatchObject({
			ok: true,
			result: { updatedRules: 0, conflictsKept: 1, recategorised: null }
		});
		let mine = (await rulesOf(dst)).find((r) => r.pattern === 'ZZQ CONFLICT')!;
		expect(mine).toMatchObject({
			categorySlug: 'shopping',
			direction: 'any',
			person: null,
			isActive: true,
			priority: 77
		});

		const use = await confirmImport(p.payload, { conflicts: 'imported', reapply: false }, dst.db);
		expect(use).toMatchObject({ ok: true, result: { updatedRules: 1, conflictsKept: 0 } });
		mine = (await rulesOf(dst)).find((r) => r.pattern === 'ZZQ CONFLICT')!;
		// priority of an existing rule is never changed by an import
		expect(mine).toMatchObject({
			categorySlug: 'supermarket',
			direction: 'in',
			person: 'David',
			isActive: false,
			priority: 77
		});
	});

	it('creates missing categories from the file, or skips those rules when asked not to', async (ctx) => {
		if (!dst) return ctx.skip();
		const doc = JSON.stringify({
			format: 'hearth.rules',
			version: 1,
			categories: [
				{
					slug: 'pets-zq',
					name: 'Pets ZQ',
					kind: 'expense',
					color: '#123456',
					icon: null,
					sortOrder: 3,
					isActive: true
				}
			],
			rules: [
				{ pattern: 'PETFOOD ZQ', categorySlug: 'pets-zq', priority: 5000 },
				{ pattern: 'NODEF ZQ', categorySlug: 'no-such-cat' }
			]
		});
		const p = await previewImport(doc, dst.db);
		if (!p.ok) throw new Error(p.error);
		expect(p.plan.missingCategory).toHaveLength(1);
		expect(p.plan.invalid).toHaveLength(1);
		expect(p.invalidCount).toBe(1);

		const off = await confirmImport(
			p.payload,
			{ createMissingCategories: false, expectedInvalid: 1, reapply: false },
			dst.db
		);
		expect(off).toMatchObject({
			ok: true,
			result: {
				createdRules: 0,
				categoriesCreated: 0,
				skippedMissingCategory: 1,
				skippedInvalid: 1
			}
		});
		expect(
			await dst.db.select().from(categories).where(eq(categories.slug, 'pets-zq'))
		).toHaveLength(0);

		const on = await confirmImport(p.payload, { expectedInvalid: 1, reapply: false }, dst.db);
		expect(on).toMatchObject({ ok: true, result: { createdRules: 1, categoriesCreated: 1 } });
		const rule = (await rulesOf(dst)).find((r) => r.pattern === 'PETFOOD ZQ')!;
		expect(rule).toMatchObject({ categorySlug: 'pets-zq', priority: 5000, matchType: 'contains' });
	});

	it('appends rules whose priority is taken after the existing ones, keeping their order', async (ctx) => {
		if (!dst) return ctx.skip();
		const max = Math.max(...(await rulesOf(dst)).map((r) => r.priority!));
		const taken = (await rulesOf(dst))[0].priority!;
		const doc = JSON.stringify({
			format: 'hearth.rules',
			version: 1,
			rules: [
				{ pattern: 'APPEND B ZQ', categorySlug: 'shopping', priority: taken + 0 },
				{ pattern: 'APPEND A ZQ', categorySlug: 'shopping', priority: taken }
			]
		});
		const p = await previewImport(doc, dst.db);
		if (!p.ok) throw new Error(p.error);
		await confirmImport(p.payload, { reapply: false }, dst.db);
		const rules = await rulesOf(dst);
		const b = rules.find((r) => r.pattern === 'APPEND B ZQ')!;
		const a = rules.find((r) => r.pattern === 'APPEND A ZQ')!;
		expect(b.priority!).toBe(max + 10);
		expect(a.priority).toBe(max + 20);
	});

	it('aborts without writing anything when the data became invalid after the preview', async (ctx) => {
		if (!dst) return ctx.skip();
		const [pets] = await dst.db.select().from(categories).where(eq(categories.slug, 'shopping'));
		void pets;
		const doc = JSON.stringify({
			format: 'hearth.rules',
			version: 1,
			rules: [
				{ pattern: 'ATOMIC OK ZQ', categorySlug: 'shopping' },
				{ pattern: 'ATOMIC BAD ZQ', categorySlug: 'supermarket', person: 'Joanna' }
			]
		});
		const p = await previewImport(doc, dst.db);
		if (!p.ok) throw new Error(p.error);
		expect(p.invalidCount).toBe(0);
		const before = await rulesOf(dst);
		// Joanna disappears between preview and confirm.
		await dst.db.execute(`SET FOREIGN_KEY_CHECKS = 0`);
		const { people } = await import('../db/schema.ts');
		const [joanna] = await dst.db.select().from(people).where(eq(people.name, 'Joanna'));
		await dst.db.update(people).set({ name: 'Joanna-renamed' }).where(eq(people.id, joanna.id));
		const out = await confirmImport(p.payload, {}, dst.db);
		await dst.db.update(people).set({ name: 'Joanna' }).where(eq(people.id, joanna.id));
		expect(out).toMatchObject({ ok: false });
		expect(await rulesOf(dst)).toEqual(before);
	});

	it('rejects a tampered payload and re-applies rules only to non-manual rows', async (ctx) => {
		if (!src || !dst) return ctx.skip();
		const bad = await confirmImport(
			'{"format":"hearth.rules","version":1,"rules":[{"pattern":"("," matchType":"regex"}]}',
			{},
			dst.db
		);
		expect(bad).toMatchObject({ ok: false });
		const garbage = await confirmImport('not json', {}, dst.db);
		expect(garbage).toMatchObject({ ok: false });

		// recategorisation counts rows that actually changed
		await seedStatements(dst.db, [
			{ date: '2026-03-01', concept: 'TARJETA-REAPPLY MARKER ZQ', cents: -500 }
		]);
		const doc = JSON.stringify({
			format: 'hearth.rules',
			version: 1,
			rules: [{ pattern: 'REAPPLY MARKER ZQ', categorySlug: 'shopping' }]
		});
		const p = await previewImport(doc, dst.db);
		if (!p.ok) throw new Error(p.error);
		const done = await confirmImport(p.payload, {}, dst.db);
		expect(done).toMatchObject({ ok: true, result: { createdRules: 1, recategorised: 1 } });
		const [row] = await dst.db
			.select()
			.from(statements)
			.where(eq(statements.concept, 'TARJETA-REAPPLY MARKER ZQ'));
		expect(row.categorySource).toBe('rule');
	});
});
