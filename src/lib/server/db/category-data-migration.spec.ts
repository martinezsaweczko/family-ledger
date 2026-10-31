import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from './index.ts';
import { runMigrationsAndSeed, migrationsFolder } from './migrate.ts';
import { categories } from './schema.ts';
import { DEFAULT_ICON_BY_SLUG } from '../../icons/registry.ts';
import { seedCategories } from './seed-data.ts';
import { setupTestDb } from '../testing/test-db.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('catmig');
});
afterAll(async () => {
	await handle?.pool.end();
});

const file = readdirSync(migrationsFolder()).find((f) => f.includes('supplies_rename'))!;
const statementsSql = readFileSync(path.join(migrationsFolder(), file), 'utf8')
	.split('--> statement-breakpoint')
	.map((s) => s.trim())
	.filter(Boolean);

async function rerunMigration(h: DbHandle) {
	for (const sql of statementsSql) await h.pool.query(sql);
}
const utilities = async (h: DbHandle) =>
	(await h.db.select().from(categories).where(eq(categories.slug, 'utilities')))[0];

describe('seed names and the Supplies rename (needs local MySQL)', () => {
	it('seeds the new English name and never the old default', async (ctx) => {
		if (!handle) return ctx.skip();
		expect((await utilities(handle)).name).toBe('Supplies');
		expect(seedCategories.some((c) => c.name === 'Suministros')).toBe(false);
		// Seeding again is idempotent and does not bring the old name back.
		await runMigrationsAndSeed(handle.db);
		expect((await utilities(handle)).name).toBe('Supplies');
	});

	it('renames an untouched legacy row and backfills the icon', async (ctx) => {
		if (!handle) return ctx.skip();
		await handle.db
			.update(categories)
			.set({ name: 'Suministros', icon: null })
			.where(eq(categories.slug, 'utilities'));
		await rerunMigration(handle);
		const row = await utilities(handle);
		expect(row.name).toBe('Supplies');
		expect(row.icon).toBe('zap');
	});

	it('preserves a name the user edited and an icon the user picked', async (ctx) => {
		if (!handle) return ctx.skip();
		await handle.db
			.update(categories)
			.set({ name: 'Household bills', icon: 'droplet' })
			.where(eq(categories.slug, 'utilities'));
		await rerunMigration(handle);
		const row = await utilities(handle);
		expect(row.name).toBe('Household bills');
		expect(row.icon).toBe('droplet');
	});

	it('backfills every seeded slug from the registry defaults only where icon is NULL', async (ctx) => {
		if (!handle) return ctx.skip();
		await handle.db.update(categories).set({ icon: null });
		await rerunMigration(handle);
		for (const c of await handle.db.select().from(categories)) {
			expect(c.icon, c.slug).toBe(DEFAULT_ICON_BY_SLUG[c.slug] ?? null);
		}
	});
});
