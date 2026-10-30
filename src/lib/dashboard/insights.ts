import { formatMoney } from '#lib/format/money.ts';
import type { Granularity } from './filters.ts';

/** Direction a KPI moved and whether that is good news. Colour is never the only signal: `text` carries it. */
export interface KpiDelta {
	dir: 'up' | 'down' | 'flat' | 'none';
	tone: 'good' | 'bad' | 'neutral';
	text: string;
}

const FLAT = 0.005;

/** `better` says which direction is good for the metric (income up, expenses down). */
export function kpiDelta(pct: number | null, better: 'up' | 'down'): KpiDelta {
	if (pct === null) return { dir: 'none', tone: 'neutral', text: 'n/a' };
	if (Math.abs(pct) < FLAT) return { dir: 'flat', tone: 'neutral', text: '0%' };
	const dir = pct > 0 ? 'up' : 'down';
	const rounded = Math.round(Math.abs(pct) * 100);
	return {
		dir,
		tone: dir === better ? 'good' : 'bad',
		text: `${pct > 0 ? '+' : '-'}${rounded}%`
	};
}

/** Percentage-point change of a ratio such as the savings rate. */
export function pointsDelta(now: number | null, before: number | null): KpiDelta {
	if (now === null || before === null) return { dir: 'none', tone: 'neutral', text: 'n/a' };
	const pts = Math.round((now - before) * 100);
	if (pts === 0) return { dir: 'flat', tone: 'neutral', text: '0 pts' };
	return {
		dir: pts > 0 ? 'up' : 'down',
		tone: pts > 0 ? 'good' : 'bad',
		text: `${pts > 0 ? '+' : '-'}${Math.abs(pts)} pts`
	};
}

export function changeInsight(noun: string, pct: number | null): string | null {
	if (pct === null) return null;
	const verb = noun.endsWith('s') ? 'are' : 'is';
	if (Math.abs(pct) < FLAT) return `${noun} ${verb} flat versus the previous period.`;
	const n = Math.round(Math.abs(pct) * 100);
	return `${noun} ${verb} ${n}% ${pct > 0 ? 'higher' : 'lower'} than the previous period.`;
}

export function topCategoryInsight(list: { name: string; sharePct: number }[]): string | null {
	const top = list[0];
	return top
		? `${top.name} is the largest expense at ${Math.round(top.sharePct)}% of spending.`
		: null;
}

export function contributionInsight(people: { name: string; sharePct: number }[]): string | null {
	if (!people.length) return null;
	if (people.length === 1) {
		return `${people[0].name} contributes ${Math.round(people[0].sharePct)}% of household income.`;
	}
	const [a, b] = people;
	return `${a.name} contributes ${Math.round(a.sharePct)}% of household income, ${b.name} ${Math.round(b.sharePct)}%.`;
}

export function recurringInsight(count: number, monthlyCents: number): string | null {
	if (count <= 0) return null;
	const noun = count === 1 ? 'recurring charge commits' : 'recurring charges commit';
	return `${count} ${noun} about ${formatMoney(monthlyCents)} a month.`;
}

export function balanceInsight(startCents: number | null, endCents: number | null): string | null {
	if (startCents === null || endCents === null) return null;
	const diff = endCents - startCents;
	if (diff === 0) return 'Balance is unchanged over the period.';
	return `Balance is ${diff > 0 ? 'up' : 'down'} ${formatMoney(Math.abs(diff))} over the period.`;
}

export function merchantInsight(
	top: { merchant: string; totalCents: number } | undefined,
	expenseCents: number
): string | null {
	if (!top || expenseCents <= 0) return null;
	return `${top.merchant} alone is ${Math.round((top.totalCents / expenseCents) * 100)}% of spending.`;
}

export function trendInsight(
	buckets: string[],
	totals: number[],
	granularity: Granularity
): string | null {
	if (!buckets.length) return null;
	let peak = 0;
	totals.forEach((v, i) => {
		if (v > totals[peak]) peak = i;
	});
	if (totals[peak] <= 0) return null;
	return `Spending peaked in ${formatBucket(buckets[peak], granularity)} at ${formatMoney(totals[peak])}.`;
}

const fmt = (opts: Intl.DateTimeFormatOptions, date: string) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(
		new Date(`${date}T00:00:00Z`)
	);

/** Short axis label for the start date of a bucket. */
export function formatBucket(bucket: string, g: Granularity): string {
	switch (g) {
		case 'day':
		case 'week':
			return fmt({ day: 'numeric', month: 'short' }, bucket);
		case 'month':
			return fmt({ month: 'short', year: '2-digit' }, bucket);
		default:
			return bucket.slice(0, 4);
	}
}

export function formatDay(date: string): string {
	return fmt({ day: 'numeric', month: 'short', year: 'numeric' }, date);
}

export function formatRange(from: string | undefined, to: string | undefined): string {
	return from && to ? `${formatDay(from)} to ${formatDay(to)}` : 'No data';
}
