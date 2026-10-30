import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count } from 'drizzle-orm';
import type { DbHandle } from './index.ts';
import { runMigrationsAndSeed } from './migrate.ts';
import { categories, categoryRules, people } from './schema.ts';
import { setupTestDb } from '../testing/test-db.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb();
});
afterAll(async () => {
	await handle?.pool.end();
});

describe('migrate + seed (needs local MySQL)', () => {
	it('is idempotent and seeds people, categories and rules', async (ctx) => {
		if (!handle) return ctx.skip();
		const { db } = handle;
		const snapshot = async () => ({
			people: (await db.select({ n: count() }).from(people))[0].n,
			categories: (await db.select({ n: count() }).from(categories))[0].n,
			rules: (await db.select({ n: count() }).from(categoryRules))[0].n
		});
		const first = await snapshot();
		await runMigrationsAndSeed(db);
		const second = await snapshot();
		expect(second).toEqual(first);
		expect(first.people).toBe(2);
		expect(first.categories).toBeGreaterThanOrEqual(20);
		expect(first.rules).toBeGreaterThan(20);
	});
});
