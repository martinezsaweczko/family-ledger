import {
	dataRange,
	listCategories,
	type AnalyticsFilter,
	type CategoryOption,
	type DataRange
} from '#lib/server/analytics/index.ts';
import { parseFilters, type FilterState } from '#lib/dashboard/filters.ts';

export interface DashboardContext {
	range: DataRange;
	categories: CategoryOption[];
	state: FilterState;
	filter: AnalyticsFilter;
}

/** Shared by every dashboard route: URL -> validated filter state -> analytics filter. */
export async function dashboardContext(url: URL): Promise<DashboardContext> {
	const [range, categories] = await Promise.all([dataRange(), listCategories()]);
	const state = parseFilters(url.searchParams, { min: range.minDate, max: range.maxDate });
	const filter: AnalyticsFilter = {
		from: state.from,
		to: state.to,
		categoryIds: state.categoryIds.length ? state.categoryIds : undefined,
		includeTransfers: state.includeTransfers
	};
	return { range, categories, state, filter };
}

export const errorMessage = (e: unknown) =>
	e instanceof Error ? e.message : 'Something went wrong while reading the data.';
