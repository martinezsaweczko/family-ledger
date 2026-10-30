import {
	balanceSeries,
	categoryBreakdown,
	categoryTrend,
	contributions,
	latestBalance,
	recurring,
	summary,
	timeSeries,
	topMerchants
} from '#lib/server/analytics/index.ts';
import { addDays, previousPeriod } from '#lib/server/analytics/buckets.ts';
import type { PageServerLoad } from './$types';
import { dashboardContext, errorMessage } from './context.server.ts';

/** Recurring charges need a long window to be recognisable, whatever range is on screen. */
const RECURRING_DAYS = 365;

export const load: PageServerLoad = async ({ url }) => {
	const { range, categories, state, filter } = await dashboardContext(url);
	const base = { range, categories, state };
	if (!state.hasData || !state.from || !state.to) return { ...base, data: null, failed: null };
	const { from, to, granularity: g } = state;
	try {
		const recurringFrom = addDays(to, -RECURRING_DAYS);
		const [sum, previousBalance, series, breakdown, trend, people, merchants, subs, balance] =
			await Promise.all([
				summary(filter),
				latestBalance(previousPeriod(from, to).to),
				timeSeries(filter, g),
				categoryBreakdown(filter),
				categoryTrend(filter, g, 6),
				contributions(filter, g),
				topMerchants(filter, 8),
				recurring({
					...filter,
					from: recurringFrom < (range.minDate ?? from) ? undefined : recurringFrom
				}),
				balanceSeries({ from, to }, g)
			]);
		return {
			...base,
			failed: null,
			data: {
				summary: sum,
				previousBalanceCents: previousBalance.cents,
				series,
				breakdown,
				trend,
				people,
				merchants,
				recurring: subs,
				balance
			}
		};
	} catch (e) {
		console.error('[dashboard] load failed', e);
		return { ...base, data: null, failed: errorMessage(e) };
	}
};
