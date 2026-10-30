import { asc, desc, eq } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, categoryRules, people, statements } from '../db/schema.ts';
import { categorize, type Rule } from '../categorizer.ts';
import { recategorizeAll } from '../categorizer-service.ts';
import { fail, isDuplicateEntry, parseInteger, text, type Result } from './validate.ts';

export const MATCH_TYPES = ['contains', 'regex'] as const;
export const DIRECTIONS = ['any', 'in', 'out'] as const;

export interface RuleInput {
	pattern: string;
	matchType: (typeof MATCH_TYPES)[number];
	direction: (typeof DIRECTIONS)[number];
	categoryId: number;
	personId: number | null;
	priority: number;
	isActive: boolean;
}

export function validateRule(raw: Record<string, unknown>): Result<RuleInput> {
	const errors: Record<string, string> = {};
	const pattern = text(raw.pattern);
	const matchType = text(raw.matchType || 'contains') as RuleInput['matchType'];
	const direction = text(raw.direction || 'any') as RuleInput['direction'];
	if (!pattern) errors.pattern = 'Pattern is required.';
	else if (pattern.length > 255) errors.pattern = 'Pattern must be at most 255 characters.';
	if (!MATCH_TYPES.includes(matchType)) errors.matchType = 'Choose contains or regex.';
	if (!DIRECTIONS.includes(direction)) errors.direction = 'Choose any, in or out.';
	if (!errors.pattern && matchType === 'regex') {
		try {
			new RegExp(pattern, 'i');
		} catch (err) {
			errors.pattern = `Invalid regular expression: ${(err as Error).message}`;
		}
	}
	const categoryId = parseInteger(raw.categoryId);
	if (categoryId === null || categoryId <= 0) errors.categoryId = 'Choose a category.';
	const personRaw = text(raw.personId);
	const personId = personRaw === '' ? null : parseInteger(personRaw);
	if (personRaw !== '' && (personId === null || personId <= 0)) errors.personId = 'Invalid person.';
	const priorityRaw = text(raw.priority);
	const priority = priorityRaw === '' ? 100 : parseInteger(priorityRaw);
	if (priority === null || priority < 0 || priority > 100000) {
		errors.priority = 'Priority must be a whole number between 0 and 100000.';
	}
	if (Object.keys(errors).length) return fail(errors);
	const isActive =
		raw.isActive === undefined ? true : raw.isActive === 'on' || raw.isActive === true;
	return {
		ok: true,
		value: {
			pattern,
			matchType,
			direction,
			categoryId: categoryId!,
			personId,
			priority: priority!,
			isActive
		}
	};
}

export interface RuleRow {
	id: number;
	pattern: string;
	matchType: 'contains' | 'regex';
	direction: 'any' | 'in' | 'out';
	categoryId: number;
	categoryName: string;
	categoryActive: boolean;
	personId: number | null;
	personName: string | null;
	priority: number;
	isActive: boolean;
}

export async function listRules(db: Db = getDb()): Promise<RuleRow[]> {
	return db
		.select({
			id: categoryRules.id,
			pattern: categoryRules.pattern,
			matchType: categoryRules.matchType,
			direction: categoryRules.direction,
			categoryId: categoryRules.categoryId,
			categoryName: categories.name,
			categoryActive: categories.isActive,
			personId: categoryRules.personId,
			personName: people.name,
			priority: categoryRules.priority,
			isActive: categoryRules.isActive
		})
		.from(categoryRules)
		.innerJoin(categories, eq(categoryRules.categoryId, categories.id))
		.leftJoin(people, eq(categoryRules.personId, people.id))
		.orderBy(asc(categoryRules.priority), asc(categoryRules.id));
}

export async function listPeople(db: Db = getDb()) {
	return db.select().from(people).orderBy(asc(people.name));
}

const DUPLICATE = { pattern: 'A rule with this pattern and match type already exists.' };

async function categoryExists(db: Db, id: number): Promise<boolean> {
	const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));
	return Boolean(c);
}

export async function createRule(
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateRule(raw);
	if (!parsed.ok) return parsed;
	if (!(await categoryExists(db, parsed.value.categoryId)))
		return fail({ categoryId: 'Unknown category.' });
	try {
		const [{ insertId }] = await db.insert(categoryRules).values(parsed.value);
		return { ok: true, value: { id: Number(insertId) } };
	} catch (err) {
		if (isDuplicateEntry(err)) return fail(DUPLICATE);
		throw err;
	}
}

export async function updateRule(
	id: number,
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateRule(raw);
	if (!parsed.ok) return parsed;
	if (!(await categoryExists(db, parsed.value.categoryId)))
		return fail({ categoryId: 'Unknown category.' });
	try {
		const [res] = await db.update(categoryRules).set(parsed.value).where(eq(categoryRules.id, id));
		if (res.affectedRows === 0) return fail({ _form: 'Rule not found.' });
		return { ok: true, value: { id } };
	} catch (err) {
		if (isDuplicateEntry(err)) return fail(DUPLICATE);
		throw err;
	}
}

/** Deleting a rule leaves already categorised statements untouched until the next re-apply. */
export async function deleteRule(id: number, db: Db = getDb()): Promise<boolean> {
	const [res] = await db.delete(categoryRules).where(eq(categoryRules.id, id));
	return res.affectedRows > 0;
}

/**
 * Moves a rule one place up (higher precedence) or down by renumbering all
 * priorities 10, 20, 30... in their current order, so ties are resolved too.
 */
export async function moveRule(
	id: number,
	direction: 'up' | 'down',
	db: Db = getDb()
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const rules = await tx
			.select({ id: categoryRules.id, priority: categoryRules.priority })
			.from(categoryRules)
			.orderBy(asc(categoryRules.priority), asc(categoryRules.id));
		const from = rules.findIndex((r) => r.id === id);
		const to = direction === 'up' ? from - 1 : from + 1;
		if (from < 0 || to < 0 || to >= rules.length) return false;
		[rules[from], rules[to]] = [rules[to], rules[from]];
		for (const [i, r] of rules.entries()) {
			const priority = (i + 1) * 10;
			if (r.priority !== priority) {
				await tx.update(categoryRules).set({ priority }).where(eq(categoryRules.id, r.id));
			}
		}
		return true;
	});
}

export interface RulePreview {
	count: number;
	sample: {
		id: number;
		bookingDate: string;
		concept: string;
		amountCents: number;
		categoryId: number | null;
		categorySource: 'rule' | 'manual' | null;
	}[];
}

/** Which statements a pattern would match (newest first), without changing anything. */
export async function previewRule(
	raw: { pattern: string; matchType?: string; direction?: string },
	db: Db = getDb()
): Promise<Result<RulePreview>> {
	const parsed = validateRule({ ...raw, categoryId: '1' });
	if (!parsed.ok) {
		const { categoryId: _ignored, ...errors } = parsed.errors;
		void _ignored;
		return fail(errors);
	}
	const rule: Rule = {
		pattern: parsed.value.pattern,
		matchType: parsed.value.matchType,
		direction: parsed.value.direction,
		categoryId: 0,
		personId: null,
		priority: 0,
		isActive: true
	};
	const rows = await db
		.select({
			id: statements.id,
			bookingDate: statements.bookingDate,
			concept: statements.concept,
			amountCents: statements.amountCents,
			categoryId: statements.categoryId,
			categorySource: statements.categorySource
		})
		.from(statements)
		.orderBy(desc(statements.bookingDate), asc(statements.id));
	const hits = rows.filter((r) => categorize(r.concept, r.amountCents, [rule]));
	return { ok: true, value: { count: hits.length, sample: hits.slice(0, 10) } };
}

export const reapplyAll = recategorizeAll;
