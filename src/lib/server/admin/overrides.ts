import { and, eq } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { statements } from '../db/schema.ts';
import { applyRules } from '../categorizer-service.ts';
import { assignCategory, type AssignOutcome } from './review.ts';
import { fail, type Result } from './validate.ts';

/**
 * Per-transaction category overrides. Only the category (and its source) of a row
 * can change here: dates and amounts of imported rows are never editable.
 * An override sets category_source = 'manual', which import upserts, rules and
 * recategorizeAll never touch.
 */
export type OverrideOutcome = AssignOutcome;

/** Sets the category by hand; optionally also creates a `contains` rule and re-applies rules to uncategorised rows. */
export function changeCategory(
	input: { statementId: number; categoryId: number; rulePattern?: string },
	db: Db = getDb()
): Promise<Result<OverrideOutcome>> {
	return assignCategory(input, db);
}

/**
 * One-click "Accept": locks an AI category in as the user's own (ai -> manual), so rules and
 * later AI runs never touch it again. Optionally also creates a rule from the merchant.
 */
export async function acceptAiCategory(
	input: { statementId: number; rulePattern?: string },
	db: Db = getDb()
): Promise<Result<OverrideOutcome>> {
	const [row] = await db
		.select({ categoryId: statements.categoryId, source: statements.categorySource })
		.from(statements)
		.where(eq(statements.id, input.statementId));
	if (!row) return fail({ _form: 'Transaction not found.' });
	if (row.source !== 'ai' || row.categoryId === null) {
		return fail({ _form: 'This transaction has no AI category to accept.' });
	}
	return assignCategory(
		{ statementId: input.statementId, categoryId: row.categoryId, rulePattern: input.rulePattern },
		db
	);
}

export interface ClearOutcome {
	statementId: number;
	/** What the rules decided for this row afterwards (null = still uncategorised). */
	categoryId: number | null;
}

/**
 * "Remove my change": drops the manual choice and lets the rules decide again for this one row.
 * Rows entered by hand in /admin/manual keep their category (it is their own data).
 */
export async function clearOverride(
	statementId: number,
	db: Db = getDb()
): Promise<Result<ClearOutcome>> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ importerId: statements.importerId, source: statements.categorySource })
			.from(statements)
			.where(eq(statements.id, statementId));
		if (!row) return fail({ _form: 'Transaction not found.' });
		if (row.importerId === 'manual') {
			return fail({ _form: 'Manual entries are edited in Admin > Manual.' });
		}
		if (row.source !== 'manual') return fail({ _form: 'This transaction has no manual change.' });
		await tx
			.update(statements)
			.set({ categoryId: null, categorySource: null })
			.where(eq(statements.id, statementId));
		await applyRules(tx, and(eq(statements.id, statementId)));
		const [after] = await tx
			.select({ categoryId: statements.categoryId })
			.from(statements)
			.where(eq(statements.id, statementId));
		return { ok: true as const, value: { statementId, categoryId: after.categoryId } };
	});
}
