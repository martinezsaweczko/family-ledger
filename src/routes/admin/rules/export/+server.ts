import { exportRulesJson } from '#lib/server/admin/rules-io.ts';
import { todayIso } from '#lib/server/manual/schedule.ts';
import type { RequestHandler } from './$types';

/** Downloads the rules and their categories as `hearth-rules-YYYY-MM-DD.json` (no statement data). */
export const GET: RequestHandler = async ({ url }) => {
	const body = await exportRulesJson({
		onlyActive: url.searchParams.get('active') === '1',
		allCategories: url.searchParams.get('categories') === 'all'
	});
	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="hearth-rules-${todayIso()}.json"`,
			'cache-control': 'no-store'
		}
	});
};
