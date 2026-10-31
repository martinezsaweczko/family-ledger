/**
 * Dashboard filter state <-> URL search params. Pure (no server imports) so the
 * same code runs in `load`, in components and in tests.
 *
 * Ranges are anchored at the latest statement date, not at today's date: the
 * data is imported by hand, so "last 6 months" must mean the six months that
 * end where the data ends.
 */
export type Granularity = 'day' | 'week' | 'month' | 'year';
export type PresetId =
	'this-month' | 'last-month' | '3m' | '6m' | '12m' | 'ytd' | 'last-year' | 'all' | 'custom';

export const PRESETS: { id: Exclude<PresetId, 'custom'>; label: string }[] = [
	{ id: 'this-month', label: 'This month' },
	{ id: 'last-month', label: 'Last month' },
	{ id: '3m', label: 'Last 3 months' },
	{ id: '6m', label: 'Last 6 months' },
	{ id: '12m', label: 'Last 12 months' },
	{ id: 'ytd', label: 'Year to date' },
	{ id: 'last-year', label: 'Last year' },
	{ id: 'all', label: 'All time' }
];

export const GRANULARITIES: { id: Granularity; label: string }[] = [
	{ id: 'day', label: 'Day' },
	{ id: 'week', label: 'Week' },
	{ id: 'month', label: 'Month' },
	{ id: 'year', label: 'Year' }
];

export const DEFAULT_PRESET: PresetId = '6m';

export interface DataBounds {
	min: string | null;
	max: string | null;
}

export interface FilterState {
	preset: PresetId;
	/** Undefined only when there is no data at all. */
	from: string | undefined;
	to: string | undefined;
	granularity: Granularity;
	/** True when the URL carried `g=`; false when the granularity was derived from the range. */
	granularityExplicit: boolean;
	categoryIds: number[];
	includeTransfers: boolean;
	hasData: boolean;
}

import { parseDate } from '#lib/format/date.ts';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const validDate = (v: string | null): v is string => {
	if (!v || !ISO.test(v)) return false;
	const t = ms(v);
	return !Number.isNaN(t) && iso(t) === v;
};
/** URL text for a date: ISO, or dd/mm/yyyy from a form posted without JS. Null when not a real date. */
const readDate = (v: string | null): string | null => {
	const parsed = parseDate(v);
	return parsed !== null && validDate(parsed) ? parsed : null;
};

const monthStart = (d: string, offset = 0) => {
	const t = new Date(ms(d));
	return iso(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, 1));
};
const monthEnd = (d: string) => iso(ms(monthStart(d, 1)) - DAY_MS);

export function daysInRange(from: string, to: string): number {
	return Math.round((ms(to) - ms(from)) / DAY_MS) + 1;
}

export function autoGranularity(from: string, to: string): Granularity {
	const days = daysInRange(from, to);
	if (days <= 35) return 'day';
	if (days <= 100) return 'week';
	if (days <= 1100) return 'month';
	return 'year';
}

const clamp = (r: { from: string; to: string }, b: { min: string; max: string }) => {
	const from = r.from < b.min ? b.min : r.from;
	const to = r.to > b.max ? b.max : r.to;
	return from > to ? { from: b.min, to: b.max } : { from, to };
};

export function presetRange(
	id: Exclude<PresetId, 'custom'>,
	bounds: { min: string; max: string }
): { from: string; to: string } {
	const anchor = bounds.max;
	const year = anchor.slice(0, 4);
	let range: { from: string; to: string };
	switch (id) {
		case 'this-month':
			range = { from: monthStart(anchor), to: anchor };
			break;
		case 'last-month':
			range = { from: monthStart(anchor, -1), to: monthEnd(monthStart(anchor, -1)) };
			break;
		case '3m':
			range = { from: monthStart(anchor, -2), to: anchor };
			break;
		case '6m':
			range = { from: monthStart(anchor, -5), to: anchor };
			break;
		case '12m':
			range = { from: monthStart(anchor, -11), to: anchor };
			break;
		case 'ytd':
			range = { from: `${year}-01-01`, to: anchor };
			break;
		case 'last-year':
			range = { from: `${Number(year) - 1}-01-01`, to: `${Number(year) - 1}-12-31` };
			break;
		default:
			range = { from: bounds.min, to: bounds.max };
	}
	return clamp(range, bounds);
}

const isPreset = (v: string | null): v is Exclude<PresetId, 'custom'> =>
	PRESETS.some((p) => p.id === v);
const isGranularity = (v: string | null): v is Granularity => GRANULARITIES.some((g) => g.id === v);

export function parseFilters(params: URLSearchParams, bounds: DataBounds): FilterState {
	const categoryIds = params
		.getAll('cat')
		.flatMap((v) => v.split(','))
		.map((s) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN))
		.filter((n) => Number.isSafeInteger(n) && n > 0);
	const includeTransfers = params.get('transfers') === '1';
	const g = params.get('g');
	const rest = {
		categoryIds: [...new Set(categoryIds)],
		includeTransfers
	};
	if (!bounds.min || !bounds.max) {
		return {
			preset: DEFAULT_PRESET,
			from: undefined,
			to: undefined,
			granularity: isGranularity(g) ? g : 'month',
			granularityExplicit: isGranularity(g),
			hasData: false,
			...rest
		};
	}
	const b = { min: bounds.min, max: bounds.max };
	const fromParam = readDate(params.get('from'));
	const toParam = readDate(params.get('to'));
	let preset: PresetId;
	let range: { from: string; to: string };
	if (fromParam || toParam) {
		preset = 'custom';
		let from = fromParam ?? b.min;
		let to = toParam ?? b.max;
		if (from > to) [from, to] = [to, from];
		range = { from, to };
	} else {
		const r = params.get('range');
		preset = isPreset(r) ? r : DEFAULT_PRESET;
		range = presetRange(preset as Exclude<PresetId, 'custom'>, b);
	}
	return {
		preset,
		...range,
		granularity: isGranularity(g) ? g : autoGranularity(range.from, range.to),
		granularityExplicit: isGranularity(g),
		hasData: true,
		...rest
	};
}

/** Query string (with leading `?`, or '') for a filter state; defaults are omitted. */
export function buildSearch(state: FilterState, extra: Record<string, string> = {}): string {
	const p = new URLSearchParams();
	if (state.preset === 'custom') {
		if (state.from) p.set('from', state.from);
		if (state.to) p.set('to', state.to);
	} else if (state.preset !== DEFAULT_PRESET) {
		p.set('range', state.preset);
	}
	if (state.granularityExplicit) p.set('g', state.granularity);
	if (state.categoryIds.length) p.set('cat', state.categoryIds.join(','));
	if (state.includeTransfers) p.set('transfers', '1');
	for (const [k, v] of Object.entries(extra)) if (v !== '') p.set(k, v);
	const s = p.toString();
	return s ? `?${s}` : '';
}
