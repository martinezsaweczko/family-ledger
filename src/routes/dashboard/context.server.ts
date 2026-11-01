import {
	dataRange,
	listCategories,
	type AnalyticsFilter,
	type CategoryOption,
	type DataRange
} from '#lib/server/analytics/index.ts';
import { ensureMaterialised } from '#lib/server/manual/recurring.ts';
import { parseFilters, type FilterState } from '#lib/dashboard/filters.ts';

export interface DashboardContext {
	range: DataRange;
	categories: CategoryOption[];
	state: FilterState;
	filter: AnalyticsFilter;
}

/** Shared by every dashboard route: URL -> validated filter state -> analytics filter. */
export async function dashboardContext(
	url: URL,
	{ withSource = false }: { withSource?: boolean } = {}
): Promise<DashboardContext> {
	await ensureMaterialised(); // recurring manual entries up to today, at most once a day
	const [range, categories] = await Promise.all([dataRange(), listCategories()]);
	const parsed = parseFilters(url.searchParams, { min: range.minDate, max: range.maxDate });
	// The source select only exists on the transactions explorer; elsewhere a stray param is ignored.
	const state = withSource ? parsed : { ...parsed, source: 'any' as const };
	const filter: AnalyticsFilter = {
		from: state.from,
		to: state.to,
		categoryIds: state.categoryIds.length ? state.categoryIds : undefined,
		includeUncategorised: state.includeUncategorised || undefined,
		source: state.source === 'any' ? undefined : state.source,
		includeTransfers: state.includeTransfers
	};
	return { range, categories, state, filter };
}

export const errorMessage = (e: unknown) =>
	e instanceof Error ? e.message : 'Something went wrong while reading the data.';
