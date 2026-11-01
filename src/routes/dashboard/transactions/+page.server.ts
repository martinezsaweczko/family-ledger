import { redirect } from '@sveltejs/kit';
import {
	countUncategorised,
	transactions,
	type TransactionSort
} from '#lib/server/analytics/index.ts';
import { overrideActions } from '#lib/server/admin/override-actions.ts';
import type { Actions, PageServerLoad } from './$types';
import { dashboardContext, errorMessage } from '../context.server.ts';

const SORTS: TransactionSort[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];
const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url }) => {
	const { range, categories, state, filter } = await dashboardContext(url, { withSource: true });
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const sortParam = url.searchParams.get('sort');
	const sort = SORTS.find((s) => s === sortParam) ?? 'date_desc';
	const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1);
	const base = { range, categories, state, q, sort };
	if (!state.hasData) return { ...base, result: null, uncategorisedCount: 0, failed: null };
	let loaded;
	try {
		loaded = await Promise.all([
			transactions(filter, { page, pageSize: PAGE_SIZE, search: q, sort }),
			countUncategorised(filter, q)
		]);
	} catch (e) {
		console.error('[dashboard/transactions] load failed', e);
		return { ...base, result: null, uncategorisedCount: 0, failed: errorMessage(e) };
	}
	const [result, uncategorisedCount] = loaded;
	// After fixing the last row of a page the list shrinks: go back to the last page that still exists.
	if (page > 1 && result.rows.length === 0 && result.total > 0) {
		const back = new URL(url);
		const lastPage = Math.ceil(result.total / PAGE_SIZE);
		if (lastPage > 1) back.searchParams.set('page', String(lastPage));
		else back.searchParams.delete('page');
		redirect(303, `${back.pathname}${back.search}`);
	}
	return { ...base, result, uncategorisedCount, failed: null };
};

/** Change category / remove my change; posted to the current URL so filters survive. */
export const actions: Actions = overrideActions;
