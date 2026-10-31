import { and, asc, desc, eq, gt, isNotNull, lte, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { previousPeriod } from './buckets.ts';
import { filterWhere, isIncomeSql, sideCentsSql, type AnalyticsFilter } from './filter.ts';

export interface Totals {
	incomeCents: number;
	/** Positive spend. */
	expenseCents: number;
	netCents: number;
	/** net / income, null when there is no income. */
	savingsRate: number | null;
	count: number;
}

export interface Delta {
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	/** Relative change vs previous period (0.1 = +10%), null when the previous value was 0. */
	incomePct: number | null;
	expensePct: number | null;
	netPct: number | null;
}

export interface Summary extends Totals {
	/** Balance after the most recent statement (account-wide, up to `to`). */
	latestBalanceCents: number | null;
	latestBalanceDate: string | null;
	previous: Totals | null;
	delta: Delta | null;
}

export async function totals(f: AnalyticsFilter, db: Db = getDb()): Promise<Totals> {
	const [row] = await db
		.select({
			income: sql<string>`COALESCE(SUM(CASE WHEN ${isIncomeSql} = 1 THEN ${sideCentsSql} ELSE 0 END), 0)`,
			expense: sql<string>`COALESCE(SUM(CASE WHEN ${isIncomeSql} = 0 THEN ${sideCentsSql} ELSE 0 END), 0)`,
			count: sql<string>`COUNT(*)`
		})
		.from(statements)
		.leftJoin(categories, eq(statements.categoryId, categories.id))
		.where(filterWhere(f));
	const incomeCents = Number(row.income);
	const expenseCents = Number(row.expense);
	const netCents = incomeCents - expenseCents;
	return {
		incomeCents,
		expenseCents,
		netCents,
		savingsRate: incomeCents > 0 ? netCents / incomeCents : null,
		count: Number(row.count)
	};
}

const pct = (now: number, before: number) =>
	before === 0 ? null : (now - before) / Math.abs(before);

export function computeDelta(now: Totals, before: Totals): Delta {
	return {
		incomeCents: now.incomeCents - before.incomeCents,
		expenseCents: now.expenseCents - before.expenseCents,
		netCents: now.netCents - before.netCents,
		incomePct: pct(now.incomeCents, before.incomeCents),
		expensePct: pct(now.expenseCents, before.expenseCents),
		netPct: pct(now.netCents, before.netCents)
	};
}

/**
 * Displayed balance = the latest BANK balance + manual entries flagged `affects_balance`
 * dated strictly after that bank row's date (and not after `upTo`). Manual rows that are not
 * flagged (e.g. cash already counted through a withdrawal) never change it. Without any bank
 * balance there is nothing to adjust, so the result stays null.
 *
 * The bank lists a day's movements newest first, so within a day the lowest id
 * is the latest movement: order by date DESC, then id ASC.
 */
export async function latestBalance(
	upTo: string | undefined,
	db: Db = getDb()
): Promise<{ cents: number | null; date: string | null }> {
	const [row] = await db
		.select({ cents: statements.balanceCents, date: statements.bookingDate })
		.from(statements)
		.where(
			and(isNotNull(statements.balanceCents), upTo ? lte(statements.bookingDate, upTo) : undefined)
		)
		.orderBy(desc(statements.bookingDate), asc(statements.id))
		.limit(1);
	if (!row || row.cents === null) return { cents: null, date: row?.date ?? null };
	const [adj] = await db
		.select({ sum: sql<string>`COALESCE(SUM(${statements.amountCents}), 0)` })
		.from(statements)
		.where(
			and(
				eq(statements.importerId, 'manual'),
				eq(statements.affectsBalance, true),
				gt(statements.bookingDate, row.date),
				upTo ? lte(statements.bookingDate, upTo) : undefined
			)
		);
	return { cents: row.cents + Number(adj.sum), date: row.date };
}

export async function summary(f: AnalyticsFilter, db: Db = getDb()): Promise<Summary> {
	const current = await totals(f, db);
	const balance = await latestBalance(f.to, db);
	let previous: Totals | null = null;
	if (f.from && f.to) {
		previous = await totals({ ...f, ...previousPeriod(f.from, f.to) }, db);
	}
	return {
		...current,
		latestBalanceCents: balance.cents,
		latestBalanceDate: balance.date,
		previous,
		delta: previous ? computeDelta(current, previous) : null
	};
}
