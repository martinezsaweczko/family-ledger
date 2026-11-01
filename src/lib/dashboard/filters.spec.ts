import { describe, expect, it } from 'vitest';
import { autoGranularity, buildSearch, parseFilters, presetRange } from './filters.ts';

const bounds = { min: '2025-01-10', max: '2026-03-20' };

describe('presetRange (anchored at the latest statement date)', () => {
	it('this month is month to date', () => {
		expect(presetRange('this-month', bounds)).toEqual({ from: '2026-03-01', to: '2026-03-20' });
	});
	it('last month is the previous full calendar month', () => {
		expect(presetRange('last-month', bounds)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
	});
	it('last 3/6/12 months cover whole calendar months up to the anchor', () => {
		expect(presetRange('3m', bounds)).toEqual({ from: '2026-01-01', to: '2026-03-20' });
		expect(presetRange('6m', bounds)).toEqual({ from: '2025-10-01', to: '2026-03-20' });
		expect(presetRange('12m', bounds)).toEqual({ from: '2025-04-01', to: '2026-03-20' });
	});
	it('year to date and last year', () => {
		expect(presetRange('ytd', bounds)).toEqual({ from: '2026-01-01', to: '2026-03-20' });
		expect(presetRange('last-year', bounds)).toEqual({ from: '2025-01-10', to: '2025-12-31' });
	});
	it('all time spans the data and ranges are clamped to the data bounds', () => {
		expect(presetRange('all', bounds)).toEqual({ from: '2025-01-10', to: '2026-03-20' });
		expect(presetRange('12m', { min: '2025-11-05', max: '2026-03-20' }).from).toBe('2025-11-05');
	});
});

describe('autoGranularity', () => {
	it('picks a bucket size by range length', () => {
		expect(autoGranularity('2026-03-01', '2026-03-20')).toBe('day');
		expect(autoGranularity('2026-01-01', '2026-03-20')).toBe('week');
		expect(autoGranularity('2025-10-01', '2026-03-20')).toBe('month');
		expect(autoGranularity('2020-01-01', '2026-03-20')).toBe('year');
	});
});

describe('parseFilters', () => {
	const p = (q: string) => parseFilters(new URLSearchParams(q), bounds);

	it('defaults to the last 6 months with automatic granularity', () => {
		expect(p('')).toMatchObject({
			preset: '6m',
			from: '2025-10-01',
			to: '2026-03-20',
			granularity: 'month',
			granularityExplicit: false,
			categoryIds: [],
			includeTransfers: false
		});
	});
	it('reads a preset, an explicit granularity, categories and the transfers toggle', () => {
		expect(p('range=ytd&g=week&cat=3,5&transfers=1')).toMatchObject({
			preset: 'ytd',
			from: '2026-01-01',
			granularity: 'week',
			granularityExplicit: true,
			categoryIds: [3, 5],
			includeTransfers: true
		});
	});
	it('custom from/to wins, is validated and swapped when reversed', () => {
		expect(p('from=2026-02-01&to=2026-02-10')).toMatchObject({
			preset: 'custom',
			from: '2026-02-01',
			to: '2026-02-10',
			granularity: 'day'
		});
		expect(p('from=2026-02-10&to=2026-02-01')).toMatchObject({
			from: '2026-02-01',
			to: '2026-02-10'
		});
	});
	it('ignores garbage values instead of throwing', () => {
		expect(p('range=nope&g=hour&from=zzz&to=2026-99-99&cat=a,,7')).toMatchObject({
			preset: '6m',
			granularityExplicit: false,
			categoryIds: [7]
		});
	});
	it('falls back to an empty range when there is no data', () => {
		expect(parseFilters(new URLSearchParams(), { min: null, max: null })).toMatchObject({
			from: undefined,
			to: undefined,
			hasData: false
		});
	});
});

describe('buildSearch', () => {
	it('omits defaults and round-trips', () => {
		const state = parseFilters(new URLSearchParams('range=ytd&cat=2,4&transfers=1'), bounds);
		const search = buildSearch(state);
		expect(search).toBe('?range=ytd&cat=2%2C4&transfers=1');
		expect(parseFilters(new URLSearchParams(search), bounds)).toMatchObject({
			preset: 'ytd',
			categoryIds: [2, 4],
			includeTransfers: true
		});
		expect(buildSearch(parseFilters(new URLSearchParams(), bounds))).toBe('');
	});
	it('serialises custom ranges and explicit granularity, with extras', () => {
		const state = parseFilters(new URLSearchParams('from=2026-02-01&to=2026-02-10&g=day'), bounds);
		expect(buildSearch(state, { page: '2', q: 'mercadona' })).toBe(
			'?from=2026-02-01&to=2026-02-10&g=day&page=2&q=mercadona'
		);
	});
});

describe('uncategorised and source filters in the URL', () => {
	const p = (q: string) => parseFilters(new URLSearchParams(q), bounds);

	it('default to off / any, so old URLs keep working', () => {
		expect(p('')).toMatchObject({ includeUncategorised: false, source: 'any' });
		expect(p('range=ytd&cat=3,5&transfers=1')).toMatchObject({
			categoryIds: [3, 5],
			includeUncategorised: false,
			source: 'any'
		});
		expect(buildSearch(p('range=ytd&cat=3,5&transfers=1'))).toBe(
			'?range=ytd&cat=3%2C5&transfers=1'
		);
	});
	it('reads uncategorised=1 alongside categories and a known source', () => {
		expect(p('cat=3&uncategorised=1&source=attention')).toMatchObject({
			categoryIds: [3],
			includeUncategorised: true,
			source: 'attention'
		});
		for (const s of ['ai', 'rule', 'mine', 'manual', 'imported']) {
			expect(p(`source=${s}`).source).toBe(s);
		}
	});
	it('ignores anything else instead of throwing', () => {
		expect(p('uncategorised=yes&source=nope')).toMatchObject({
			includeUncategorised: false,
			source: 'any'
		});
		expect(p('uncategorised=0').includeUncategorised).toBe(false);
	});
	it('round-trips through buildSearch and omits the defaults', () => {
		const q = 'range=all&cat=2&uncategorised=1&source=mine';
		const state = p(q);
		const built = buildSearch(state);
		expect(new URLSearchParams(built)).toEqual(
			new URLSearchParams('range=all&cat=2&uncategorised=1&source=mine')
		);
		expect(p(built.slice(1))).toEqual(state);
		expect(buildSearch({ ...state, includeUncategorised: false, source: 'any' })).toBe(
			'?range=all&cat=2'
		);
	});
	it('works without any data too', () => {
		expect(
			parseFilters(new URLSearchParams('uncategorised=1&source=ai'), { min: null, max: null })
		).toMatchObject({
			hasData: false,
			includeUncategorised: true,
			source: 'ai'
		});
	});
});
