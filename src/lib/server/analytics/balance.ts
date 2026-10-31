import { and, asc, desc, gte, isNotNull, lte } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { bucketStart, generateBuckets, type Granularity } from './buckets.ts';

export interface BalancePoint {
	bucket: string;
	balanceCents: number;
}

/**
 * Closing balance per bucket. `rows` must be ordered by date ascending and, within a
 * day, by id descending (the bank lists a day newest first, so the last row is the
 * latest movement). Empty buckets carry the previous balance forward; buckets before
 * the first known balance are omitted.
 */
export function lastBalancePerBucket(
	rows: { date: string; cents: number }[],
	g: Granularity,
	from: string,
	to: string
): BalancePoint[] {
	const closing = new Map<string, number>();
	for (const r of rows) closing.set(bucketStart(r.date, g), r.cents);
	const out: BalancePoint[] = [];
	let carried: number | undefined;
	for (const bucket of generateBuckets(from, to, g)) {
		carried = closing.get(bucket) ?? carried;
		if (carried !== undefined) out.push({ bucket, balanceCents: carried });
	}
	return out;
}

/** Account balance over time. Balance is account-wide, so category filters do not apply. */
export async function balanceSeries(
	range: { from: string; to: string },
	g: Granularity,
	db: Db = getDb()
): Promise<BalancePoint[]> {
	const rows = await db
		.select({ date: statements.bookingDate, cents: statements.balanceCents })
		.from(statements)
		.where(
			and(
				isNotNull(statements.balanceCents),
				gte(statements.bookingDate, range.from),
				lte(statements.bookingDate, range.to)
			)
		)
		.orderBy(asc(statements.bookingDate), desc(statements.id));
	return lastBalancePerBucket(
		rows.map((r) => ({ date: r.date, cents: r.cents ?? 0 })),
		g,
		range.from,
		range.to
	);
}

export interface CategoryOption {
	id: number;
	slug: string;
	name: string;
	color: string;
	icon: string | null;
	kind: 'expense' | 'income' | 'transfer' | 'ignore';
}

/** Active categories in display order, for filters and chips. */
export async function listCategories(db: Db = getDb()): Promise<CategoryOption[]> {
	return db
		.select({
			id: categories.id,
			slug: categories.slug,
			name: categories.name,
			color: categories.color,
			icon: categories.icon,
			kind: categories.kind
		})
		.from(categories)
		.orderBy(asc(categories.sortOrder), asc(categories.name));
}
