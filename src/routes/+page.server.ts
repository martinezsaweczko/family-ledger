import { dataRange, summary, timeSeries } from '#lib/server/analytics/index.ts';
import { ensureMaterialised } from '#lib/server/manual/recurring.ts';
import { presetRange } from '#lib/dashboard/filters.ts';
import type { PageServerLoad } from './$types';

/** Live numbers for the landing page. "This month" is the month of the latest statement. */
export const load: PageServerLoad = async () => {
	try {
		await ensureMaterialised();
		const range = await dataRange();
		if (!range.minDate || !range.maxDate) return { live: null, failed: false };
		const bounds = { min: range.minDate, max: range.maxDate };
		const month = presetRange('this-month', bounds);
		const year = presetRange('12m', bounds);
		const [current, months] = await Promise.all([summary(month), timeSeries(year, 'month')]);
		return {
			failed: false,
			live: {
				asOf: range.maxDate,
				monthStart: month.from,
				balanceCents: current.latestBalanceCents,
				incomeCents: current.incomeCents,
				expenseCents: current.expenseCents,
				savingsRate: current.savingsRate,
				months: months.map((m) => ({
					bucket: m.bucket,
					incomeCents: m.incomeCents,
					expenseCents: m.expenseCents
				}))
			}
		};
	} catch (e) {
		console.error('[landing] could not load live numbers', e);
		return { live: null, failed: true };
	}
};
