export type Granularity = 'day' | 'week' | 'month' | 'year';

const DAY_MS = 86_400_000;

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
	return toIso(toMs(iso) + days * DAY_MS);
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
	return Math.round((toMs(toIsoDate) - toMs(fromIso)) / DAY_MS);
}

/** First day of the bucket (weeks start on Monday) containing `iso`. */
export function bucketStart(iso: string, g: Granularity): string {
	const d = new Date(toMs(iso));
	if (g === 'day') return iso;
	if (g === 'week') return addDays(iso, -((d.getUTCDay() + 6) % 7));
	if (g === 'month') return `${iso.slice(0, 7)}-01`;
	return `${iso.slice(0, 4)}-01-01`;
}

function nextBucket(start: string, g: Granularity): string {
	if (g === 'day') return addDays(start, 1);
	if (g === 'week') return addDays(start, 7);
	const y = Number(start.slice(0, 4));
	const m = Number(start.slice(5, 7));
	if (g === 'year') return `${y + 1}-01-01`;
	return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Every bucket start from the bucket of `from` through the bucket of `to`, inclusive. */
export function generateBuckets(from: string, to: string, g: Granularity): string[] {
	const out: string[] = [];
	const last = bucketStart(to, g);
	for (let b = bucketStart(from, g); b <= last; b = nextBucket(b, g)) out.push(b);
	return out;
}

/** The period of equal length immediately before [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
	const length = daysBetween(from, to) + 1;
	const prevTo = addDays(from, -1);
	return { from: addDays(prevTo, -(length - 1)), to: prevTo };
}

/** Months spanned by [from, to], never below 1 (so short ranges do not inflate averages). */
export function monthsSpan(from: string, to: string): number {
	return Math.max(1, (daysBetween(from, to) + 1) / 30.4375);
}
