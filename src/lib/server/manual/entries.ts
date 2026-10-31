import { createHash, randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, isNotNull, isNull, like, sql, type SQL } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { accounts, categories, importBatches, statements } from '../db/schema.ts';
import { fail, isIsoDate, parseCents, parseInteger, text, type Result } from '../admin/validate.ts';

/** importer_id of every hand-entered or recurring-generated row. */
export const MANUAL_IMPORTER = 'manual';

/** Account used when no bank file was ever imported (otherwise rows join the first account). */
export const SYNTHETIC_ACCOUNT_IBAN = 'MANUAL-ENTRIES';

export interface ManualEntryInput {
	bookingDate: string;
	/** Always positive; direction decides the sign. */
	amountCents: number;
	direction: 'in' | 'out';
	concept: string;
	categoryId: number | null;
	note: string | null;
	affectsBalance: boolean;
}

export function validateEntry(raw: Record<string, unknown>): Result<ManualEntryInput> {
	const errors: Record<string, string> = {};
	const bookingDate = text(raw.bookingDate);
	if (!isIsoDate(bookingDate)) errors.bookingDate = 'Enter a valid date.';
	const amountCents = parseCents(raw.amount);
	if (amountCents === null) errors.amount = 'Enter an amount above 0, e.g. 40 or 40.50.';
	const direction = text(raw.direction || 'out');
	if (direction !== 'in' && direction !== 'out') errors.direction = 'Choose expense or income.';
	const concept = text(raw.concept);
	if (!concept) errors.concept = 'Concept is required.';
	else if (concept.length > 255) errors.concept = 'Concept must be at most 255 characters.';
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
			bookingDate,
			amountCents: amountCents!,
			direction: direction as 'in' | 'out',
			concept,
			categoryId,
			note: note || null,
			affectsBalance: raw.affectsBalance === 'on' || raw.affectsBalance === true
		}
	};
}

/**
 * The (account, batch) manual rows hang off. Statements need a batch, so one batch with
 * importer 'manual' is created on demand. They join the first account (the joint account
 * that is audited); only when no account exists yet is a synthetic one created.
 */
export async function manualTarget(
	db: Db = getDb()
): Promise<{ accountId: number; batchId: number }> {
	const [existing] = await db
		.select({ id: importBatches.id, accountId: importBatches.accountId })
		.from(importBatches)
		.where(eq(importBatches.importerId, MANUAL_IMPORTER))
		.orderBy(asc(importBatches.id))
		.limit(1);
	if (existing) return { accountId: existing.accountId, batchId: existing.id };
	let [account] = await db.select().from(accounts).orderBy(asc(accounts.id)).limit(1);
	if (!account) {
		await db
			.insert(accounts)
			.values({ iban: SYNTHETIC_ACCOUNT_IBAN, name: 'Manual entries' })
			.onDuplicateKeyUpdate({ set: { iban: sql`iban` } });
		[account] = await db.select().from(accounts).orderBy(asc(accounts.id)).limit(1);
	}
	const [{ insertId }] = await db.insert(importBatches).values({
		importerId: MANUAL_IMPORTER,
		filename: 'Manual entries',
		fileSha256: createHash('sha256').update('hearth-manual-entries').digest('hex'),
		accountId: account.id
	});
	return { accountId: account.id, batchId: Number(insertId) };
}

export async function activeCategoryId(db: Db, id: number | null): Promise<boolean> {
	if (id === null) return true;
	const [c] = await db
		.select({ active: categories.isActive })
		.from(categories)
		.where(eq(categories.id, id));
	return Boolean(c?.active);
}

export const signedCents = (direction: 'in' | 'out', cents: number) =>
	direction === 'out' ? -cents : cents;

export const rawManual = (note: string | null) => ({ manual: true, note });

export const randomDedupHash = () =>
	createHash('sha256').update(`manual:${randomUUID()}`).digest('hex');

export async function createManualEntry(
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateEntry(raw);
	if (!parsed.ok) return parsed;
	const v = parsed.value;
	if (!(await activeCategoryId(db, v.categoryId))) {
		return fail({ categoryId: 'Choose an active category.' });
	}
	const { accountId, batchId } = await manualTarget(db);
	const [{ insertId }] = await db.insert(statements).values({
		accountId,
		importerId: MANUAL_IMPORTER,
		dedupHash: randomDedupHash(),
		bookingDate: v.bookingDate,
		valueDate: v.bookingDate,
		concept: v.concept,
		amountCents: signedCents(v.direction, v.amountCents),
		balanceCents: null,
		rawJson: rawManual(v.note),
		batchId,
		categoryId: v.categoryId,
		categorySource: v.categoryId === null ? null : 'manual',
		note: v.note,
		affectsBalance: v.affectsBalance
	});
	return { ok: true, value: { id: Number(insertId) } };
}

/** Only rows entered here (importer 'manual') can be edited: imported rows never. */
export async function updateManualEntry(
	id: number,
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<{ id: number }>> {
	const parsed = validateEntry(raw);
	if (!parsed.ok) return parsed;
	const v = parsed.value;
	if (!(await activeCategoryId(db, v.categoryId))) {
		return fail({ categoryId: 'Choose an active category.' });
	}
	const [res] = await db
		.update(statements)
		.set({
			bookingDate: v.bookingDate,
			valueDate: v.bookingDate,
			concept: v.concept,
			amountCents: signedCents(v.direction, v.amountCents),
			rawJson: rawManual(v.note),
			categoryId: v.categoryId,
			categorySource: v.categoryId === null ? null : 'manual',
			note: v.note,
			affectsBalance: v.affectsBalance
		})
		.where(and(eq(statements.id, id), eq(statements.importerId, MANUAL_IMPORTER)));
	if (res.affectedRows === 0) return fail({ _form: 'Manual entry not found.' });
	return { ok: true, value: { id } };
}

export async function deleteManualEntry(id: number, db: Db = getDb()): Promise<boolean> {
	const [res] = await db
		.delete(statements)
		.where(and(eq(statements.id, id), eq(statements.importerId, MANUAL_IMPORTER)));
	return res.affectedRows > 0;
}

export interface ManualEntryRow {
	id: number;
	bookingDate: string;
	concept: string;
	amountCents: number;
	categoryId: number | null;
	categoryName: string | null;
	categorySlug: string | null;
	categoryColor: string | null;
	categoryIcon: string | null;
	note: string | null;
	affectsBalance: boolean;
	recurringId: number | null;
}

export async function listManualEntries(
	opts: {
		page?: number;
		pageSize?: number;
		search?: string;
		kind?: 'all' | 'oneoff' | 'recurring';
	} = {},
	db: Db = getDb()
): Promise<{ rows: ManualEntryRow[]; total: number; page: number; pageSize: number }> {
	const pageSize = Math.min(Math.max(Math.floor(opts.pageSize ?? 15), 1), 100);
	const page = Math.max(Math.floor(opts.page ?? 1), 1);
	const search = opts.search?.trim();
	const conds: (SQL | undefined)[] = [eq(statements.importerId, MANUAL_IMPORTER)];
	if (opts.kind === 'oneoff') conds.push(isNull(statements.recurringId));
	if (opts.kind === 'recurring') conds.push(isNotNull(statements.recurringId));
	if (search)
		conds.push(like(statements.concept, `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
	const where = and(...conds);
	const [{ n }] = await db.select({ n: count() }).from(statements).where(where);
	const rows = await db
		.select({
			id: statements.id,
			bookingDate: statements.bookingDate,
			concept: statements.concept,
			amountCents: statements.amountCents,
			categoryId: statements.categoryId,
			categoryName: categories.name,
			categorySlug: categories.slug,
			categoryColor: categories.color,
			categoryIcon: categories.icon,
			note: statements.note,
			affectsBalance: statements.affectsBalance,
			recurringId: statements.recurringId
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(where)
		.orderBy(desc(statements.bookingDate), desc(statements.id))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return { rows, total: n, page, pageSize };
}
