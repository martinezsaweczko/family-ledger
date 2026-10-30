import { error } from '@sveltejs/kit';
import {
	categoryBreakdown,
	categoryTrend,
	summary,
	topMerchants,
	transactions,
	type TransactionSort
} from '#lib/server/analytics/index.ts';
import type { PageServerLoad } from './$types';
import { dashboardContext, errorMessage } from '../../context.server.ts';

const SORTS: TransactionSort[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];
const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url, params }) => {
	const ctx = await dashboardContext(url);
	const category = ctx.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Unknown category');
	const { state } = ctx;
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const sortParam = url.searchParams.get('sort');
	const sort = SORTS.find((s) => s === sortParam) ?? 'date_desc';
	const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1);
	const base = { range: ctx.range, categories: ctx.categories, state, category, q, sort };
	if (!state.hasData || !state.from || !state.to) return { ...base, data: null, failed: null };

	// This page is about one category; the category picker from the URL is not applied.
	const everything = {
		...ctx.filter,
		categoryIds: undefined,
		includeTransfers: ctx.filter.includeTransfers || category.kind === 'transfer'
	};
	const only = { ...everything, categoryIds: [category.id] };
	const side = category.kind === 'income' ? 'income' : 'expense';
	try {
		const [breakdown, sum, trend, merchants, rows] = await Promise.all([
			categoryBreakdown(everything),
			summary(only),
			categoryTrend(only, state.granularity, 1, undefined, side),
			side === 'expense' ? topMerchants(only, 8) : Promise.resolve([]),
			transactions(only, { page, pageSize: PAGE_SIZE, search: q, sort })
		]);
		const own = [...breakdown.expense, ...breakdown.income].find(
			(c) => c.categoryId === category.id
		);
		return {
			...base,
			failed: null,
			data: {
				side,
				stats: own ?? null,
				summary: sum,
				trend: trend.series[0] ?? null,
				buckets: trend.buckets,
				merchants,
				rows
			}
		};
	} catch (e) {
		console.error('[dashboard/category] load failed', e);
		return { ...base, data: null, failed: errorMessage(e) };
	}
};
