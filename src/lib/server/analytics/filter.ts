import { and, between, gte, inArray, lte, eq, sql, type SQL } from 'drizzle-orm';
import { categories, statements } from '../db/schema.ts';
import type { CategoryKind } from '../db/seed-data.ts';
import type { Granularity } from './buckets.ts';

/**
 * Common filter for every analytics function. Dates are inclusive YYYY-MM-DD.
 *
 * Conventions for all outputs:
 * - amounts are integer cents;
 * - income is reported as a positive number, expenses as POSITIVE spend numbers
 *   (a refund inside an expense category lowers spend, it is not income);
 * - categories of kind `transfer` and `ignore` are excluded unless
 *   `includeTransfers` is set, or `kinds` lists them explicitly;
 * - `kinds` restricts to categories of those kinds (uncategorised rows are then excluded).
 */
export interface AnalyticsFilter {
	from?: string;
	to?: string;
	categoryIds?: number[];
	personId?: number;
	kinds?: CategoryKind[];
	includeTransfers?: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string | undefined, name: string): void {
	if (value !== undefined && (!ISO.test(value) || Number.isNaN(Date.parse(value)))) {
		throw new Error(`${name} must be a YYYY-MM-DD date`);
	}
}

/** WHERE clause for statements LEFT JOIN categories. */
export function filterWhere(f: AnalyticsFilter): SQL | undefined {
	assertIsoDate(f.from, 'from');
	assertIsoDate(f.to, 'to');
	const parts: (SQL | undefined)[] = [];
	if (f.from && f.to) parts.push(between(statements.bookingDate, f.from, f.to));
	else if (f.from) parts.push(gte(statements.bookingDate, f.from));
	else if (f.to) parts.push(lte(statements.bookingDate, f.to));
	if (f.categoryIds?.length) parts.push(inArray(statements.categoryId, f.categoryIds));
	if (f.personId !== undefined) parts.push(eq(statements.personId, f.personId));
	if (f.kinds?.length) parts.push(inArray(categories.kind, f.kinds));
	else if (!f.includeTransfers) {
		parts.push(
			sql`(${categories.kind} IS NULL OR ${categories.kind} NOT IN ('transfer', 'ignore'))`
		);
	}
	return and(...parts);
}

/**
 * 1 when the row counts as income. Income categories are income, expense
 * categories are spend (even for refunds); rows without an income/expense
 * category fall back to the sign of the amount.
 */
export const isIncomeSql = sql<number>`(CASE ${categories.kind}
	WHEN 'income' THEN 1
	WHEN 'expense' THEN 0
	ELSE ${statements.amountCents} > 0 END)`;

/** Contribution of a row to its side: income as signed amount, spend as -amount. */
export const sideCentsSql = sql<string>`(CASE WHEN ${isIncomeSql} = 1 THEN ${statements.amountCents} ELSE -${statements.amountCents} END)`;

/** Start date (YYYY-MM-DD string) of the bucket containing booking_date. */
export function bucketSql(g: Granularity): SQL<string> {
	const d = statements.bookingDate;
	switch (g) {
		case 'day':
			return sql<string>`DATE_FORMAT(${d}, '%Y-%m-%d')`;
		case 'week':
			return sql<string>`DATE_FORMAT(DATE_SUB(${d}, INTERVAL WEEKDAY(${d}) DAY), '%Y-%m-%d')`;
		case 'month':
			return sql<string>`DATE_FORMAT(${d}, '%Y-%m-01')`;
		case 'year':
			return sql<string>`DATE_FORMAT(${d}, '%Y-01-01')`;
		default:
			throw new Error(`Unknown granularity: ${String(g)}`);
	}
}
