import { eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { cleanMerchant } from '../importers/merchant.ts';
import { daysBetween } from './buckets.ts';
import { filterWhere, isIncomeSql, sideCentsSql, type AnalyticsFilter } from './filter.ts';

export interface MerchantTotal {
	merchant: string;
	/** Positive spend. */
	totalCents: number;
	count: number;
	avgCents: number;
}

/** Expense rows pre-aggregated per exact concept in SQL, merged per normalised merchant here. */
export async function topMerchants(
	f: AnalyticsFilter,
	limit = 10,
	db: Db = getDb()
): Promise<MerchantTotal[]> {
	const rows = await db
		.select({
			concept: statements.concept,
			total: sql<string>`SUM(${sideCentsSql})`,
			count: sql<string>`COUNT(*)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(sql`${filterWhere(f) ?? sql`1 = 1`} AND ${isIncomeSql} = 0`)
		.groupBy(statements.concept);
	const merged = new Map<string, { total: number; count: number }>();
	for (const r of rows) {
		const key = cleanMerchant(r.concept) || r.concept;
		const m = merged.get(key) ?? { total: 0, count: 0 };
		m.total += Number(r.total);
		m.count += Number(r.count);
		merged.set(key, m);
	}
	return [...merged]
		.map(([merchant, m]) => ({
			merchant,
			totalCents: m.total,
			count: m.count,
			avgCents: Math.round(m.total / m.count)
		}))
		.sort((a, b) => b.totalCents - a.totalCents)
		.slice(0, limit);
}

export interface RecurringExpense {
	merchant: string;
	occurrences: number;
	/** Median charge, positive cents. */
	medianCents: number;
	/** Cost per month assuming the monthly cadence (= median charge). */
	estimatedMonthlyCents: number;
	medianIntervalDays: number;
	lastDate: string;
	lastCents: number;
}

export interface ExpenseRow {
	date: string;
	merchant: string;
	cents: number;
}

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const mid = s.length >> 1;
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Pure detector. A merchant is recurring when, after dropping charges more than
 * 15% away from the median amount, it has >= 3 charges whose gaps are roughly
 * monthly (25-35 days) for at least 60% of the intervals.
 */
export function detectRecurring(rows: ExpenseRow[]): RecurringExpense[] {
	const groups = new Map<string, ExpenseRow[]>();
	for (const r of rows) {
		const g = groups.get(r.merchant) ?? [];
		g.push(r);
		groups.set(r.merchant, g);
	}
	const out: RecurringExpense[] = [];
	for (const [merchant, all] of groups) {
		if (all.length < 3) continue;
		const med = median(all.map((r) => r.cents));
		const steady = all
			.filter((r) => Math.abs(r.cents - med) <= med * 0.15)
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
		if (steady.length < 3) continue;
		const gaps = steady.slice(1).map((r, i) => daysBetween(steady[i].date, r.date));
		const monthly = gaps.filter((d) => d >= 25 && d <= 35).length;
		if (monthly / gaps.length < 0.6) continue;
		const medianCents = Math.round(median(steady.map((r) => r.cents)));
		const last = steady[steady.length - 1];
		out.push({
			merchant,
			occurrences: steady.length,
			medianCents,
			estimatedMonthlyCents: medianCents,
			medianIntervalDays: median(gaps),
			lastDate: last.date,
			lastCents: last.cents
		});
	}
	return out.sort((a, b) => b.estimatedMonthlyCents - a.estimatedMonthlyCents);
}

export async function recurring(f: AnalyticsFilter, db: Db = getDb()): Promise<RecurringExpense[]> {
	const rows = await db
		.select({
			date: statements.bookingDate,
			concept: statements.concept,
			cents: sideCentsSql
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(sql`${filterWhere(f) ?? sql`1 = 1`} AND ${isIncomeSql} = 0`);
	return detectRecurring(
		rows
			.map((r) => ({
				date: r.date,
				merchant: cleanMerchant(r.concept) || r.concept,
				cents: Number(r.cents)
			}))
			.filter((r) => r.cents > 0)
	);
}
