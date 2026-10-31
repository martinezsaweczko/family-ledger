import { eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { monthsSpan } from './buckets.ts';
import { filterWhere, isIncomeSql, sideCentsSql, type AnalyticsFilter } from './filter.ts';
import { dataRange } from './transactions.ts';

export interface CategoryTotal {
	/** null = uncategorised. */
	categoryId: number | null;
	slug: string | null;
	name: string;
	color: string;
	/** Registry key; null = default for the slug. */
	icon: string | null;
	totalCents: number;
	/** Share of its side's total (income or expense), 0-100. */
	sharePct: number;
	count: number;
	avgPerMonthCents: number;
}

export interface CategoryBreakdown {
	/** Income categories, largest first. */
	income: CategoryTotal[];
	/** Expense categories (positive spend), largest first. */
	expense: CategoryTotal[];
}

export async function categoryBreakdown(
	f: AnalyticsFilter,
	db: Db = getDb()
): Promise<CategoryBreakdown> {
	const rows = await db
		.select({
			categoryId: statements.categoryId,
			slug: categories.slug,
			name: categories.name,
			color: categories.color,
			icon: categories.icon,
			isIncome: sql<number>`${isIncomeSql}`.as('is_income'),
			total: sql<string>`COALESCE(SUM(${sideCentsSql}), 0)`,
			count: sql<string>`COUNT(*)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(filterWhere(f))
		.groupBy(
			statements.categoryId,
			categories.slug,
			categories.name,
			categories.color,
			categories.icon,
			sql`is_income`
		);

	let from = f.from;
	let to = f.to;
	if (!from || !to) {
		const range = await dataRange(db);
		from ??= range.minDate ?? undefined;
		to ??= range.maxDate ?? undefined;
	}
	const months = from && to ? monthsSpan(from, to) : 1;

	const build = (income: boolean): CategoryTotal[] => {
		const side = rows.filter((r) => Boolean(Number(r.isIncome)) === income);
		const sideTotal = side.reduce((n, r) => n + Number(r.total), 0);
		return side
			.map((r) => ({
				categoryId: r.categoryId,
				slug: r.slug,
				name: r.name ?? 'Uncategorised',
				color: r.color ?? '#94A3B8',
				icon: r.icon,
				totalCents: Number(r.total),
				sharePct: sideTotal ? (Number(r.total) / sideTotal) * 100 : 0,
				count: Number(r.count),
				avgPerMonthCents: Math.round(Number(r.total) / months)
			}))
			.sort((a, b) => b.totalCents - a.totalCents);
	};
	return { income: build(true), expense: build(false) };
}
