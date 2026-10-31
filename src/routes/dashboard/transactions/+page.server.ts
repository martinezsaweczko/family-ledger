import { transactions, type TransactionSort } from '#lib/server/analytics/index.ts';
import { overrideActions } from '#lib/server/admin/override-actions.ts';
import type { Actions, PageServerLoad } from './$types';
import { dashboardContext, errorMessage } from '../context.server.ts';

const SORTS: TransactionSort[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];
const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url }) => {
	const { range, categories, state, filter } = await dashboardContext(url);
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const sortParam = url.searchParams.get('sort');
	const sort = SORTS.find((s) => s === sortParam) ?? 'date_desc';
	const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1);
	const base = { range, categories, state, q, sort };
	if (!state.hasData) return { ...base, result: null, failed: null };
	try {
		const result = await transactions(filter, { page, pageSize: PAGE_SIZE, search: q, sort });
		return { ...base, result, failed: null };
	} catch (e) {
		console.error('[dashboard/transactions] load failed', e);
		return { ...base, result: null, failed: errorMessage(e) };
	}
};

/** Change category / remove my change; posted to the current URL so filters survive. */
export const actions: Actions = overrideActions;
