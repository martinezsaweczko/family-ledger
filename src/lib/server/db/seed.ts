import { sql, eq } from 'drizzle-orm';
import type { Db } from './index.ts';
import { categories, categoryRules, people } from './schema.ts';
import { seedCategories, seedPeople, seedRules } from './seed-data.ts';

/**
 * Idempotent: only inserts rows that do not exist yet (by unique key) and never
 * overwrites values the user may have edited later.
 */
export async function seed(db: Db): Promise<void> {
	await db
		.insert(people)
		.values(seedPeople.map((name) => ({ name })))
		.onDuplicateKeyUpdate({ set: { name: sql`name` } });

	await db
		.insert(categories)
		.values(seedCategories.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })))
		.onDuplicateKeyUpdate({ set: { slug: sql`slug` } });

	const cats = new Map((await db.select().from(categories)).map((c) => [c.slug, c.id]));
	const folks = new Map((await db.select().from(people)).map((p) => [p.name, p.id]));

	const values = seedRules.map((r) => {
		const categoryId = cats.get(r.category);
		if (categoryId === undefined)
			throw new Error(`Seed rule references unknown category ${r.category}`);
		if (r.person && !folks.has(r.person)) throw new Error(`Unknown person ${r.person}`);
		return {
			pattern: r.pattern,
			matchType: r.matchType,
			categoryId,
			personId: r.person ? (folks.get(r.person) ?? null) : null,
			priority: r.priority ?? 100,
			direction: r.direction ?? 'any'
		};
	});
	await db
		.insert(categoryRules)
		.values(values)
		.onDuplicateKeyUpdate({ set: { pattern: sql`pattern` } });
}

export async function categoryIdBySlug(db: Db, slug: string): Promise<number | undefined> {
	const [row] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.slug, slug));
	return row?.id;
}
