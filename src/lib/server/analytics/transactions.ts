import { and, asc, count, desc, eq, lte, min, max, isNull, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, people, statements } from '../db/schema.ts';
import { todayIso } from '../manual/schedule.ts';
import { cleanMerchant } from '../importers/merchant.ts';
import { filterWhere, type AnalyticsFilter } from './filter.ts';

export type TransactionSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface TransactionRow {
	id: number;
	bookingDate: string;
	concept: string;
	/** Signed cents as booked by the bank: negative = money out. */
	amountCents: number;
	balanceCents: number | null;
	categoryId: number | null;
	categoryName: string | null;
	categorySlug: string | null;
	categoryColor: string | null;
	categoryIcon: string | null;
	/** 'manual' = the user chose the category (survives re-imports); 'rule' = rules decided. */
	categorySource: 'rule' | 'manual' | null;
	/** True for rows entered by hand in /admin/manual (not from a bank file). */
	isManual: boolean;
	/** Default pattern for "also create a rule from this". */
	suggestedPattern: string;
	personName: string | null;
}

export interface TransactionPage {
	rows: TransactionRow[];
	total: number;
	page: number;
	pageSize: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function transactions(
	f: AnalyticsFilter,
	opts: { page?: number; pageSize?: number; search?: string; sort?: TransactionSort } = {},
	db: Db = getDb()
): Promise<TransactionPage> {
	const pageSize = Math.min(Math.max(Math.floor(opts.pageSize ?? 25), 1), 200);
	const page = Math.max(Math.floor(opts.page ?? 1), 1);
	const search = opts.search?.trim();
	const where = and(
		filterWhere(f),
		search ? sql`${statements.concept} LIKE ${`%${escapeLike(search)}%`}` : undefined
	);
	const order = {
		date_desc: [desc(statements.bookingDate), asc(statements.id)],
		date_asc: [asc(statements.bookingDate), desc(statements.id)],
		amount_desc: [desc(statements.amountCents), desc(statements.bookingDate)],
		amount_asc: [asc(statements.amountCents), desc(statements.bookingDate)]
	}[opts.sort ?? 'date_desc'];

	const [{ n }] = await db
		.select({ n: count() })
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(where);
	const rows = await db
		.select({
			id: statements.id,
			bookingDate: statements.bookingDate,
			concept: statements.concept,
			amountCents: statements.amountCents,
			balanceCents: statements.balanceCents,
			categoryId: statements.categoryId,
			categoryName: categories.name,
			categorySlug: categories.slug,
			categoryColor: categories.color,
			categoryIcon: categories.icon,
			categorySource: statements.categorySource,
			isManual: sql<number>`(${statements.importerId} = 'manual')`,
			personName: people.name
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.leftJoin(people, eq(statements.personId, people.id))
		.where(where)
		.orderBy(...order)
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return {
		rows: rows.map((r) => ({
			...r,
			isManual: Boolean(Number(r.isManual)),
			suggestedPattern: cleanMerchant(r.concept) || r.concept.trim()
		})),
		total: n,
		page,
		pageSize
	};
}

export interface DataRange {
	minDate: string | null;
	maxDate: string | null;
	count: number;
	uncategorisedCount: number;
}

/**
 * Bounds of the stored data, for default ranges and the empty state. Ranges are anchored at
 * `maxDate` = the newest booking date over ALL rows (bank and manual) that is not in the
 * future, so a weekly manual entry after the last import still shows in "this month".
 * Rows dated after `today` (scheduled ahead by hand) never push the anchor forward.
 */
export async function dataRange(db: Db = getDb(), today: string = todayIso()): Promise<DataRange> {
	const [r] = await db
		.select({ lo: min(statements.bookingDate), hi: max(statements.bookingDate), n: count() })
		.from(statements);
	const [pastHi] = await db
		.select({ hi: max(statements.bookingDate) })
		.from(statements)
		.where(lte(statements.bookingDate, today));
	r.hi = pastHi.hi ?? r.hi;
	const [u] = await db.select({ n: count() }).from(statements).where(isNull(statements.categoryId));
	return { minDate: r.lo, maxDate: r.hi, count: r.n, uncategorisedCount: u.n };
}
