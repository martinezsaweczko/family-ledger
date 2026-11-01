import { eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, people, statements } from '../db/schema.ts';
import { generateBuckets, type Granularity } from './buckets.ts';
import {
	bucketSql,
	filterWhere,
	isIncomeSql,
	sideCentsSql,
	type AnalyticsFilter
} from './filter.ts';

export interface TimeBucket {
	/** First day of the bucket, YYYY-MM-DD (weeks start on Monday). */
	bucket: string;
	incomeCents: number;
	/** Positive spend. */
	expenseCents: number;
	netCents: number;
}

/** Bucket list for the filter range; open ends are taken from the data buckets. */
function bucketRange(f: AnalyticsFilter, seen: string[], g: Granularity): string[] {
	const sorted = [...seen].sort();
	const from = f.from ?? sorted[0];
	const to = f.to ?? sorted[sorted.length - 1];
	return from && to ? generateBuckets(from, to, g) : [];
}

export async function timeSeries(
	f: AnalyticsFilter,
	granularity: Granularity,
	db: Db = getDb()
): Promise<TimeBucket[]> {
	const bucket = bucketSql(granularity);
	const rows = await db
		.select({
			bucket: sql<string>`${bucket}`.as('bucket'),
			income: sql<string>`COALESCE(SUM(CASE WHEN ${isIncomeSql} = 1 THEN ${sideCentsSql} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${isIncomeSql} = 0 THEN ${sideCentsSql} ELSE 0 END), 0)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(filterWhere(f))
		.groupBy(sql`bucket`);
	const byBucket = new Map(rows.map((r) => [r.bucket, r]));
	return bucketRange(f, [...byBucket.keys()], granularity).map((b) => {
		const r = byBucket.get(b);
		const incomeCents = Number(r?.income ?? 0);
		const expenseCents = Number(r?.expense ?? 0);
		return { bucket: b, incomeCents, expenseCents, netCents: incomeCents - expenseCents };
	});
}

export interface TrendSeries {
	/** null for "Uncategorised" and for the aggregated "Other" series. */
	categoryId: number | null;
	name: string;
	color: string;
	/** One value per bucket (positive cents), zero-filled. */
	values: number[];
	totalCents: number;
}

export interface CategoryTrend {
	buckets: string[];
	series: TrendSeries[];
}

const OTHER_COLOR = '#94A3B8';

/**
 * Per-bucket totals per category for stacked charts. Keeps the `topN` categories
 * of the chosen side by total and folds the rest into an "Other" series.
 */
export async function categoryTrend(
	f: AnalyticsFilter,
	granularity: Granularity,
	topN = 6,
	db: Db = getDb(),
	side: 'expense' | 'income' = 'expense'
): Promise<CategoryTrend> {
	const bucket = bucketSql(granularity);
	const wantIncome = side === 'income' ? 1 : 0;
	const rows = await db
		.select({
			bucket: sql<string>`${bucket}`.as('bucket'),
			categoryId: statements.categoryId,
			name: categories.name,
			color: categories.color,
			total: sql<string>`COALESCE(SUM(${sideCentsSql}), 0)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(sql`${filterWhere(f) ?? sql`1 = 1`} AND ${isIncomeSql} = ${wantIncome}`)
		.groupBy(sql`bucket`, statements.categoryId, categories.name, categories.color);

	const buckets = bucketRange(f, [...new Set(rows.map((r) => r.bucket))], granularity);
	const index = new Map(buckets.map((b, i) => [b, i]));
	const byCategory = new Map<number | null, TrendSeries>();
	for (const r of rows) {
		let s = byCategory.get(r.categoryId);
		if (!s) {
			s = {
				categoryId: r.categoryId,
				name: r.name ?? 'Uncategorised',
				color: r.color ?? OTHER_COLOR,
				values: buckets.map(() => 0),
				totalCents: 0
			};
			byCategory.set(r.categoryId, s);
		}
		const i = index.get(r.bucket);
		if (i === undefined) continue;
		s.values[i] += Number(r.total);
		s.totalCents += Number(r.total);
	}
	const ranked = [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents);
	const top = ranked.slice(0, topN);
	const rest = ranked.slice(topN);
	if (rest.length) {
		const other: TrendSeries = {
			categoryId: null,
			name: 'Other',
			color: OTHER_COLOR,
			values: buckets.map(() => 0),
			totalCents: 0
		};
		for (const s of rest) {
			s.values.forEach((v, i) => (other.values[i] += v));
			other.totalCents += s.totalCents;
		}
		top.push(other);
	}
	return { buckets, series: top };
}

export interface PersonContribution {
	personId: number | null;
	name: string;
	totalCents: number;
	/** Share of all attributed income, 0-100. */
	sharePct: number;
	values: number[];
}

export interface Contributions {
	buckets: string[];
	people: PersonContribution[];
	totalCents: number;
}

/** Income per person (salary contributions) per bucket. Unattributed income appears as "Unattributed". */
export async function contributions(
	f: AnalyticsFilter,
	granularity: Granularity,
	db: Db = getDb()
): Promise<Contributions> {
	const bucket = bucketSql(granularity);
	const rows = await db
		.select({
			bucket: sql<string>`${bucket}`.as('bucket'),
			personId: statements.personId,
			name: people.name,
			total: sql<string>`COALESCE(SUM(${sideCentsSql}), 0)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.leftJoin(people, eq(statements.personId, people.id))
		.where(sql`${filterWhere(f) ?? sql`1 = 1`} AND ${isIncomeSql} = 1`)
		.groupBy(sql`bucket`, statements.personId, people.name);

	const buckets = bucketRange(f, [...new Set(rows.map((r) => r.bucket))], granularity);
	const index = new Map(buckets.map((b, i) => [b, i]));
	const byPerson = new Map<number | null, PersonContribution>();
	for (const r of rows) {
		let p = byPerson.get(r.personId);
		if (!p) {
			p = {
				personId: r.personId,
				name: r.name ?? 'Unattributed',
				totalCents: 0,
				sharePct: 0,
				values: buckets.map(() => 0)
			};
			byPerson.set(r.personId, p);
		}
		const i = index.get(r.bucket);
		if (i === undefined) continue;
		p.values[i] += Number(r.total);
		p.totalCents += Number(r.total);
	}
	const list = [...byPerson.values()].sort((a, b) => b.totalCents - a.totalCents);
	const totalCents = list.reduce((n, p) => n + p.totalCents, 0);
	for (const p of list) p.sharePct = totalCents ? (p.totalCents / totalCents) * 100 : 0;
	return { buckets, people: list, totalCents };
}
