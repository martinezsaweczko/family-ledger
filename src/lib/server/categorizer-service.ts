import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { getDb, type Db } from './db/index.ts';
import { categoryRules, statements } from './db/schema.ts';
import { categorize, sortRules, type Rule } from './categorizer.ts';

/** Db or an open transaction: both expose the same query builders. */
export type DbLike = Pick<Db, 'select' | 'update'>;

export async function loadRules(db: DbLike): Promise<Rule[]> {
	const rows = await db.select().from(categoryRules).where(eq(categoryRules.isActive, true));
	return sortRules(rows);
}

export interface ApplyResult {
	examined: number;
	matched: number;
	cleared: number;
}

const CHUNK = 500;

/**
 * Applies rules to the statements selected by `where`. Precedence: manual > rule > ai >
 * uncategorised. Rows with category_source = 'manual' are never touched, whatever `where` says.
 * A matching rule replaces an 'ai' category; an 'ai' row no rule matches is kept as it is.
 * Rows previously set by a rule that no longer match are reset to uncategorised.
 */
export async function applyRules(db: DbLike, where: SQL | undefined): Promise<ApplyResult> {
	const rules = await loadRules(db);
	const notManual = or(
		isNull(statements.categorySource),
		eq(statements.categorySource, 'rule'),
		eq(statements.categorySource, 'ai')
	);
	const rows = await db
		.select({
			id: statements.id,
			concept: statements.concept,
			amountCents: statements.amountCents,
			categoryId: statements.categoryId,
			personId: statements.personId,
			source: statements.categorySource
		})
		.from(statements)
		.where(and(notManual, where));

	const groups = new Map<string, { categoryId: number; personId: number | null; ids: number[] }>();
	const clear: number[] = [];
	let matched = 0;
	for (const row of rows) {
		const hit = categorize(row.concept, row.amountCents, rules, { presorted: true });
		if (hit) {
			matched++;
			if (
				row.categoryId === hit.categoryId &&
				row.personId === hit.personId &&
				row.source === 'rule'
			) {
				continue;
			}
			const key = `${hit.categoryId}:${hit.personId ?? ''}`;
			const g = groups.get(key) ?? { ...hit, ids: [] };
			g.ids.push(row.id);
			groups.set(key, g);
		} else if (row.source === 'rule') {
			clear.push(row.id);
		}
	}

	for (const g of groups.values()) {
		for (let i = 0; i < g.ids.length; i += CHUNK) {
			await db
				.update(statements)
				.set({
					categoryId: g.categoryId,
					personId: g.personId,
					categorySource: 'rule',
					aiConfidence: null,
					aiModel: null
				})
				.where(and(notManual, inArray(statements.id, g.ids.slice(i, i + CHUNK))));
		}
	}
	for (let i = 0; i < clear.length; i += CHUNK) {
		await db
			.update(statements)
			.set({ categoryId: null, personId: null, categorySource: null })
			.where(and(notManual, inArray(statements.id, clear.slice(i, i + CHUNK))));
	}
	return { examined: rows.length, matched, cleared: clear.length };
}

/** Categorise rows of one import batch that have no category yet. */
export function categorizeNewRows(db: DbLike, batchId: number) {
	return applyRules(
		db,
		and(
			eq(statements.batchId, batchId),
			isNull(statements.categoryId),
			isNull(statements.categorySource)
		)
	);
}

/** Re-apply the current rules to every non-manual row. */
export function recategorizeAll(db: Db = getDb()) {
	return db.transaction((tx) => applyRules(tx, sql`1 = 1`));
}
