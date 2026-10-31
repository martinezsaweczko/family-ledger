import { createHash } from 'node:crypto';
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, recurringEntries, statements, type RecurringEntry } from '../db/schema.ts';
import {
	fail,
	isIsoDate,
	normalizeDate,
	parseCents,
	parseInteger,
	text,
	type Result
} from '../admin/validate.ts';
import {
	MANUAL_IMPORTER,
	activeCategoryId,
	manualTarget,
	rawManual,
	signedCents
} from './entries.ts';
import { addDays, occurrences, todayIso, type Frequency } from './schedule.ts';

export const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly'];

export interface RecurringInput {
	concept: string;
	amountCents: number;
	direction: 'in' | 'out';
	categoryId: number | null;
	frequency: Frequency;
	anchor: number;
	startDate: string;
	endDate: string | null;
	affectsBalance: boolean;
	note: string | null;
}

export function validateRecurring(raw: Record<string, unknown>): Result<RecurringInput> {
	const errors: Record<string, string> = {};
	const concept = text(raw.concept);
	if (!concept) errors.concept = 'Concept is required.';
	else if (concept.length > 255) errors.concept = 'Concept must be at most 255 characters.';
	const amountCents = parseCents(raw.amount);
	if (amountCents === null) errors.amount = 'Enter an amount above 0, e.g. 40 or 40,50.';
	const direction = text(raw.direction || 'out');
	if (direction !== 'in' && direction !== 'out') errors.direction = 'Choose expense or income.';
	const frequency = text(raw.frequency) as Frequency;
	if (!FREQUENCIES.includes(frequency))
		errors.frequency = 'Choose weekly, every two weeks or monthly.';
	const anchor = parseInteger(raw.anchor);
	const max = frequency === 'monthly' ? 31 : 7;
	if (anchor === null || anchor < 1 || anchor > max) {
		errors.anchor =
			frequency === 'monthly' ? 'Choose a day of the month (1-31).' : 'Choose a weekday.';
	}
	const startDate = normalizeDate(raw.startDate);
	if (!isIsoDate(startDate)) errors.startDate = 'Enter a valid start date.';
	const endText = text(raw.endDate);
	const endRaw = endText === '' ? '' : normalizeDate(endText) || endText;
	if (endRaw !== '' && !isIsoDate(endRaw))
		errors.endDate = 'Enter a valid end date or leave it empty.';
	else if (endRaw !== '' && isIsoDate(startDate) && endRaw < startDate) {
		errors.endDate = 'The end date cannot be before the start date.';
	}
	const catRaw = text(raw.categoryId);
	const categoryId = catRaw === '' ? null : parseInteger(catRaw);
	if (catRaw !== '' && (categoryId === null || categoryId <= 0))
		errors.categoryId = 'Invalid category.';
	const note = text(raw.note);
	if (note.length > 500) errors.note = 'Note must be at most 500 characters.';
	if (Object.keys(errors).length) return fail(errors);
	return {
		ok: true,
		value: {
			concept,
			amountCents: amountCents!,
			direction: direction as 'in' | 'out',
			categoryId,
			frequency,
			anchor: anchor!,
			startDate,
			endDate: endRaw || null,
			affectsBalance: raw.affectsBalance === 'on' || raw.affectsBalance === true,
			note: note || null
		}
	};
}

export const recurringHash = (recurringId: number, date: string) =>
	createHash('sha256').update(`recurring:${recurringId}:${date}`).digest('hex');

export interface MaterialiseResult {
	/** Rows newly inserted by this run (reruns insert 0). */
	inserted: number;
}

/**
 * Idempotent: inserts the occurrences of every active recurring entry up to `upTo`
 * (default today). The dedup hash is deterministic per (recurring id, date) and each entry
 * remembers `last_generated`, so reruns never duplicate and a deleted occurrence stays deleted.
 * Edits therefore only affect dates after `last_generated`.
 */
export async function materialiseRecurring(
	upTo: string = todayIso(),
	db: Db = getDb()
): Promise<MaterialiseResult> {
	const entries = await db
		.select()
		.from(recurringEntries)
		.where(eq(recurringEntries.isActive, true));
	let inserted = 0;
	for (const e of entries) {
		const from = e.lastGenerated ? addDays(e.lastGenerated, 1) : e.startDate;
		const to = e.endDate && e.endDate < upTo ? e.endDate : upTo;
		if (from > to) continue;
		const dates = occurrences(
			{ frequency: e.frequency, anchor: e.anchor, startDate: e.startDate, endDate: e.endDate },
			from,
			to
		);
		const existing = dates.length
			? new Set(
					(
						await db
							.select({ h: statements.dedupHash })
							.from(statements)
							.where(
								inArray(
									statements.dedupHash,
									dates.map((d) => recurringHash(e.id, d))
								)
							)
					).map((r) => r.h)
				)
			: new Set<string>();
		const fresh = dates.filter((d) => !existing.has(recurringHash(e.id, d)));
		if (fresh.length) {
			const { accountId, batchId } = await manualTarget(db);
			await db
				.insert(statements)
				.values(
					fresh.map((date) => ({
						accountId,
						importerId: MANUAL_IMPORTER,
						dedupHash: recurringHash(e.id, date),
						bookingDate: date,
						valueDate: date,
						concept: e.concept,
						amountCents: signedCents(e.direction, e.amountCents),
						balanceCents: null,
						rawJson: rawManual(e.note),
						batchId,
						categoryId: e.categoryId,
						categorySource: e.categoryId === null ? null : ('manual' as const),
						note: e.note,
						affectsBalance: e.affectsBalance,
						recurringId: e.id
					}))
				)
				.onDuplicateKeyUpdate({ set: { dedupHash: sql`dedup_hash` } });
			inserted += fresh.length;
		}
		await db
			.update(recurringEntries)
			.set({ lastGenerated: to })
			.where(eq(recurringEntries.id, e.id));
	}
	return { inserted };
}

let lastRunFor: string | null = null;

/**
 * Cheap guard for page loads: runs the materialiser at most once per calendar day per
 * process (and again after `force`, e.g. after an admin edit). Failures are logged, never thrown,
 * so a dashboard never breaks because of it.
 */
export async function ensureMaterialised(force = false, db: Db = getDb()): Promise<void> {
	const today = todayIso();
	if (!force && lastRunFor === today) return;
	try {
		await materialiseRecurring(today, db);
		lastRunFor = today;
	} catch (e) {
		console.error('[recurring] materialise failed', e);
	}
}

export interface RecurringRow extends RecurringEntry {
	categoryName: string | null;
	categoryIcon: string | null;
	categorySlug: string | null;
	categoryColor: string | null;
	generatedCount: number;
}

export async function listRecurring(db: Db = getDb()): Promise<RecurringRow[]> {
	const counts = await db
		.select({ id: statements.recurringId, n: count() })
		.from(statements)
		.groupBy(statements.recurringId);
	const byId = new Map(counts.map((c) => [c.id, c.n]));
	const rows = await db
		.select({
			e: recurringEntries,
			categoryName: categories.name,
			categoryIcon: categories.icon,
			categorySlug: categories.slug,
			categoryColor: categories.color
		})
		.from(recurringEntries)
		.leftJoin(categories, eq(recurringEntries.categoryId, categories.id))
		.orderBy(asc(recurringEntries.concept), asc(recurringEntries.id));
	return rows.map((r) => ({ ...r.e, ...r, generatedCount: byId.get(r.e.id) ?? 0 }));
}

export async function createRecurring(
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateRecurring(raw);
	if (!parsed.ok) return parsed;
	if (!(await activeCategoryId(db, parsed.value.categoryId))) {
		return fail({ categoryId: 'Choose an active category.' });
	}
	const [{ insertId }] = await db.insert(recurringEntries).values(parsed.value);
	return { ok: true, value: { id: Number(insertId) } };
}

/** Edits the template only: rows already generated keep their values (past dates are history). */
export async function updateRecurring(
	id: number,
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateRecurring(raw);
	if (!parsed.ok) return parsed;
	if (!(await activeCategoryId(db, parsed.value.categoryId))) {
		return fail({ categoryId: 'Choose an active category.' });
	}
	const [res] = await db
		.update(recurringEntries)
		.set(parsed.value)
		.where(eq(recurringEntries.id, id));
	if (res.affectedRows === 0) return fail({ _form: 'Recurring entry not found.' });
	return { ok: true, value: { id } };
}

/** Pause or resume. Resuming never backfills the paused gap: generation restarts from today. */
export async function setRecurringActive(
	id: number,
	active: boolean,
	today: string = todayIso(),
	db: Db = getDb()
): Promise<boolean> {
	const [row] = await db.select().from(recurringEntries).where(eq(recurringEntries.id, id));
	if (!row) return false;
	const yesterday = addDays(today, -1);
	await db
		.update(recurringEntries)
		.set({
			isActive: active,
			lastGenerated:
				active && (!row.lastGenerated || row.lastGenerated < yesterday)
					? yesterday
					: row.lastGenerated
		})
		.where(eq(recurringEntries.id, id));
	return true;
}

/** Ends the series today: nothing is generated after the end date. */
export async function endRecurring(
	id: number,
	today: string = todayIso(),
	db: Db = getDb()
): Promise<boolean> {
	const [res] = await db
		.update(recurringEntries)
		.set({ endDate: today })
		.where(eq(recurringEntries.id, id));
	return res.affectedRows > 0;
}

/** Counts generated rows dated after `today` (what "also delete future entries" would remove). */
export async function countFutureGenerated(
	id: number,
	today: string = todayIso(),
	db: Db = getDb()
): Promise<number> {
	const [{ n }] = await db
		.select({ n: count() })
		.from(statements)
		.where(and(eq(statements.recurringId, id), gt(statements.bookingDate, today)));
	return n;
}

/**
 * Deletes the recurring entry. Generated rows stay (detached) unless `deleteFuture`, which
 * removes those dated after today. Past generated rows are history and are kept.
 */
export async function deleteRecurring(
	id: number,
	opts: { deleteFuture?: boolean; today?: string } = {},
	db: Db = getDb()
): Promise<{ deleted: boolean; futureRemoved: number }> {
	const today = opts.today ?? todayIso();
	return db.transaction(async (tx) => {
		let futureRemoved = 0;
		if (opts.deleteFuture) {
			const [r] = await tx
				.delete(statements)
				.where(and(eq(statements.recurringId, id), gt(statements.bookingDate, today)));
			futureRemoved = r.affectedRows;
		}
		const [res] = await tx.delete(recurringEntries).where(eq(recurringEntries.id, id));
		return { deleted: res.affectedRows > 0, futureRemoved };
	});
}
