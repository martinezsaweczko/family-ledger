import { and, asc, count, desc, eq, isNull, like, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, categoryRules, statements } from '../db/schema.ts';
import { applyRules } from '../categorizer-service.ts';
import { cleanMerchant } from '../importers/merchant.ts';
import { fail, text, type Result } from './validate.ts';

export interface ReviewRow {
	id: number;
	bookingDate: string;
	concept: string;
	amountCents: number;
	/** Editable default for the "also create a rule" pattern. */
	suggestedPattern: string;
}

export interface ReviewPage {
	rows: ReviewRow[];
	total: number;
	page: number;
	pageSize: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const uncategorised = and(isNull(statements.categoryId), isNull(statements.categorySource));

/** Default pattern for a rule created from a statement: the cleaned merchant name. */
export const defaultPattern = (concept: string): string => cleanMerchant(concept) || concept.trim();

export async function listUncategorised(
	opts: { page?: number; pageSize?: number; search?: string } = {},
	db: Db = getDb()
): Promise<ReviewPage> {
	const pageSize = Math.min(Math.max(Math.floor(opts.pageSize ?? 25), 1), 100);
	const page = Math.max(Math.floor(opts.page ?? 1), 1);
	const search = opts.search?.trim();
	const where = and(
		uncategorised,
		search ? like(statements.concept, `%${escapeLike(search)}%`) : undefined
	);
	const [{ n }] = await db.select({ n: count() }).from(statements).where(where);
	const rows = await db
		.select({
			id: statements.id,
			bookingDate: statements.bookingDate,
			concept: statements.concept,
			amountCents: statements.amountCents
		})
		.from(statements)
		.where(where)
		.orderBy(desc(statements.bookingDate), asc(statements.id))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return {
		rows: rows.map((r) => ({ ...r, suggestedPattern: defaultPattern(r.concept) })),
		total: n,
		page,
		pageSize
	};
}

export interface AssignOutcome {
	statementId: number;
	/** Set when a rule was created or already existed for the pattern. */
	rule: { id: number; pattern: string; created: boolean } | null;
	/** Other uncategorised rows the rules categorised after the assignment. */
	alsoCategorised: number;
}

async function activeCategory(db: Pick<Db, 'select'>, id: number) {
	const [c] = await db.select().from(categories).where(eq(categories.id, id));
	return c?.isActive ? c : undefined;
}

/** Creates a `contains` rule (or reuses the identical one) and re-applies rules to uncategorised rows. */
async function ensureRule(db: Pick<Db, 'select' | 'insert'>, pattern: string, categoryId: number) {
	const [existing] = await db
		.select({ id: categoryRules.id })
		.from(categoryRules)
		.where(and(eq(categoryRules.pattern, pattern), eq(categoryRules.matchType, 'contains')));
	if (existing) return { id: existing.id, created: false };
	const [{ insertId }] = await db
		.insert(categoryRules)
		.values({ pattern, matchType: 'contains', categoryId, priority: 100, direction: 'any' });
	return { id: Number(insertId), created: true };
}

function checkPattern(pattern: string): Record<string, string> | null {
	if (pattern.length < 2) return { pattern: 'Pattern must have at least 2 characters.' };
	if (pattern.length > 255) return { pattern: 'Pattern must be at most 255 characters.' };
	return null;
}

/**
 * Manual assignment for one statement (category_source = 'manual'). With
 * `rulePattern`, also creates a `contains` rule and re-applies rules to the
 * remaining uncategorised rows, reporting how many it categorised.
 */
export async function assignCategory(
	input: { statementId: number; categoryId: number; rulePattern?: string },
	db: Db = getDb()
): Promise<Result<AssignOutcome>> {
	const pattern = input.rulePattern === undefined ? undefined : text(input.rulePattern);
	if (pattern !== undefined) {
		const bad = checkPattern(pattern);
		if (bad) return fail(bad);
	}
	return db.transaction(async (tx) => {
		if (!(await activeCategory(tx, input.categoryId))) {
			return fail({ categoryId: 'Choose an active category.' });
		}
		const [res] = await tx
			.update(statements)
			.set({ categoryId: input.categoryId, categorySource: 'manual' })
			.where(eq(statements.id, input.statementId));
		if (res.affectedRows === 0) return fail({ _form: 'Statement not found.' });
		let rule: AssignOutcome['rule'] = null;
		let alsoCategorised = 0;
		if (pattern !== undefined) {
			const r = await ensureRule(tx, pattern, input.categoryId);
			rule = { ...r, pattern };
			alsoCategorised = (await applyRules(tx, uncategorised)).matched;
		}
		return { ok: true as const, value: { statementId: input.statementId, rule, alsoCategorised } };
	});
}

export interface Suggestion {
	/** Cleaned merchant name, used as the rule pattern. */
	merchant: string;
	count: number;
	/** Absolute sum of the amounts, cents. */
	totalCents: number;
}

/** Most frequent merchants among uncategorised rows (>= 2 occurrences), for one-click rules. */
export async function suggestedRules(limit = 8, db: Db = getDb()): Promise<Suggestion[]> {
	const rows = await db
		.select({
			concept: statements.concept,
			n: count(),
			total: sql<string>`SUM(ABS(${statements.amountCents}))`
		})
		.from(statements)
		.where(uncategorised)
		.groupBy(statements.concept);
	const merged = new Map<string, Suggestion>();
	for (const r of rows) {
		const merchant = defaultPattern(r.concept);
		const s = merged.get(merchant) ?? { merchant, count: 0, totalCents: 0 };
		s.count += r.n;
		s.totalCents += Number(r.total);
		merged.set(merchant, s);
	}
	return [...merged.values()]
		.filter((s) => s.count >= 2 && s.merchant.length >= 2)
		.sort((a, b) => b.count - a.count || b.totalCents - a.totalCents)
		.slice(0, limit);
}

/** One-click suggestion: create the rule for the merchant and apply it to every uncategorised row. */
export async function applySuggestion(
	input: { merchant: string; categoryId: number },
	db: Db = getDb()
): Promise<Result<{ rule: { id: number; created: boolean }; categorised: number }>> {
	const pattern = text(input.merchant);
	const bad = checkPattern(pattern);
	if (bad) return fail(bad);
	return db.transaction(async (tx) => {
		if (!(await activeCategory(tx, input.categoryId))) {
			return fail({ categoryId: 'Choose an active category.' });
		}
		const rule = await ensureRule(tx, pattern, input.categoryId);
		const { matched } = await applyRules(tx, uncategorised);
		return { ok: true as const, value: { rule, categorised: matched } };
	});
}
