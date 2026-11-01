import type { EChartsCoreOption } from 'echarts/core';
import { formatMoney, formatMoneyCompact } from '#lib/format/money.ts';
import { formatPercent } from '#lib/format/number.ts';
import type { ChartTheme } from './chart-theme.ts';
import type { Granularity } from './filters.ts';
import { formatBucket } from './insights.ts';
import { chartColor } from '#lib/theme/color.ts';

/** Plain shapes of the analytics outputs the charts need (kept structural so this stays client-safe). */
export interface BucketRow {
	bucket: string;
	incomeCents: number;
	expenseCents: number;
	netCents: number;
}
export interface SeriesRow {
	name: string;
	color: string;
	values: number[];
	/** True for the aggregated "Other" / neutral series. */
	neutral?: boolean;
	slug?: string | null;
}
export interface CategorySlice {
	name: string;
	slug: string | null;
	color: string;
	totalCents: number;
}

const euros = (cents: number) => cents / 100;

export function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Compact money for axes: `1,2k €`, `340 €`, `2M €`. */
export const compactMoney = formatMoneyCompact;

const base = (t: ChartTheme) => ({
	textStyle: { fontFamily: t.font, color: t.inkSoft, fontSize: 12 },
	tooltip: {
		trigger: 'axis' as const,
		axisPointer: { type: 'shadow' as const, shadowStyle: { color: t.pointer } },
		backgroundColor: t.card,
		borderColor: t.line,
		textStyle: { color: t.ink, fontSize: 12 },
		extraCssText: `box-shadow:${t.shadow};`,
		confine: true
	}
});

const moneyAxis = (t: ChartTheme) => ({
	type: 'value' as const,
	axisLabel: { color: t.inkSoft, formatter: (v: number) => compactMoney(v * 100) },
	splitLine: { lineStyle: { color: t.line } },
	axisLine: { show: false }
});

const categoryAxis = (t: ChartTheme, labels: string[]) => ({
	type: 'category' as const,
	data: labels,
	axisLine: { lineStyle: { color: t.line } },
	axisTick: { show: false },
	axisLabel: { color: t.inkSoft, hideOverlap: true }
});

const grid = { left: 8, right: 12, top: 40, bottom: 4, containLabel: true };
const legend = (t: ChartTheme) => ({
	top: 0,
	left: 0,
	icon: 'roundRect',
	itemWidth: 10,
	itemHeight: 10,
	textStyle: { color: t.ink, fontSize: 12 }
});

interface TipItem {
	dataIndex: number;
	marker: string;
	seriesName: string;
	value: number;
}

/** Tooltip body: one row per series with a colour swatch, name and money. */
function seriesTooltip(g: Granularity, buckets: string[]) {
	return (params: unknown) => {
		const list = params as TipItem[];
		if (!list.length) return '';
		const head = esc(formatBucket(buckets[list[0].dataIndex], g));
		const rows = list
			.filter((p) => p.value !== 0 && p.value !== undefined)
			.map(
				(p) =>
					`<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker}${esc(p.seriesName)}</span><b style="font-variant-numeric:tabular-nums">${formatMoney(Math.round(p.value * 100))}</b></div>`
			)
			.join('');
		return `<div style="font-weight:600;margin-bottom:4px">${head}</div>${rows}`;
	};
}

export function incomeExpenseOption(
	rows: BucketRow[],
	g: Granularity,
	t: ChartTheme
): EChartsCoreOption {
	const labels = rows.map((r) => formatBucket(r.bucket, g));
	const buckets = rows.map((r) => r.bucket);
	return {
		...base(t),
		tooltip: { ...base(t).tooltip, formatter: seriesTooltip(g, buckets) },
		legend: legend(t),
		grid,
		xAxis: categoryAxis(t, labels),
		yAxis: moneyAxis(t),
		series: [
			{
				name: 'Income',
				type: 'bar',
				barMaxWidth: 28,
				itemStyle: { color: t.primary, borderRadius: [3, 3, 0, 0] },
				data: rows.map((r) => euros(r.incomeCents))
			},
			{
				name: 'Expenses',
				type: 'bar',
				barMaxWidth: 28,
				itemStyle: { color: t.attention, borderRadius: [3, 3, 0, 0] },
				data: rows.map((r) => euros(r.expenseCents))
			},
			{
				name: 'Net',
				type: 'line',
				symbol: 'circle',
				symbolSize: 7,
				lineStyle: { color: t.highlight, width: 2 },
				itemStyle: { color: t.highlight },
				data: rows.map((r) => euros(r.netCents))
			}
		]
	};
}

export function stackedOption(
	buckets: string[],
	series: SeriesRow[],
	g: Granularity,
	t: ChartTheme
): EChartsCoreOption {
	return {
		...base(t),
		tooltip: { ...base(t).tooltip, formatter: seriesTooltip(g, buckets) },
		legend: { ...legend(t), type: 'scroll' },
		grid: { ...grid, top: 44 },
		xAxis: categoryAxis(
			t,
			buckets.map((b) => formatBucket(b, g))
		),
		yAxis: moneyAxis(t),
		series: series.map((s) => ({
			name: s.name,
			type: 'bar',
			stack: 'total',
			barMaxWidth: 36,
			emphasis: { focus: 'series' },
			itemStyle: {
				color: s.neutral ? t.slate : chartColor(s.color, t.scheme),
				borderColor: t.card,
				borderWidth: 1
			},
			data: s.values.map(euros)
		}))
	};
}

export function donutOption(slices: CategorySlice[], t: ChartTheme): EChartsCoreOption {
	const total = slices.reduce((n, s) => n + s.totalCents, 0);
	return {
		textStyle: { fontFamily: t.font },
		tooltip: {
			trigger: 'item',
			backgroundColor: t.card,
			borderColor: t.line,
			textStyle: { color: t.ink, fontSize: 12 },
			extraCssText: `box-shadow:${t.shadow};`,
			confine: true,
			formatter: (p: { name: string; value: number; percent: number }) =>
				`${esc(p.name)}<br/><b>${formatMoney(Math.round(p.value * 100))}</b> (${formatPercent(Math.round(p.percent) / 100)})`
		},
		title: {
			text: formatMoney(total),
			subtext: 'spent',
			left: 'center',
			top: '38%',
			itemGap: 2,
			textStyle: { color: t.ink, fontSize: 18, fontWeight: 600, fontFamily: t.font },
			subtextStyle: { color: t.inkSoft, fontSize: 12, fontFamily: t.font }
		},
		series: [
			{
				type: 'pie',
				radius: ['58%', '88%'],
				center: ['50%', '50%'],
				avoidLabelOverlap: true,
				label: { show: false },
				labelLine: { show: false },
				itemStyle: { borderColor: t.card, borderWidth: 2 },
				data: slices.map((s) => ({
					name: s.name,
					value: euros(s.totalCents),
					slug: s.slug,
					itemStyle: { color: s.slug ? chartColor(s.color, t.scheme) : t.slate }
				}))
			}
		]
	};
}

export function hbarOption(
	items: { label: string; cents: number }[],
	t: ChartTheme
): EChartsCoreOption {
	const rows = [...items].reverse();
	return {
		textStyle: { fontFamily: t.font },
		tooltip: {
			...base(t).tooltip,
			trigger: 'axis',
			formatter: (p: { name: string; value: number }[]) =>
				`${esc(p[0].name)}<br/><b>${formatMoney(Math.round(p[0].value * 100))}</b>`
		},
		grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
		xAxis: { ...moneyAxis(t), axisLabel: { show: false }, splitLine: { show: false } },
		yAxis: {
			type: 'category',
			data: rows.map((r) => r.label),
			axisTick: { show: false },
			axisLine: { lineStyle: { color: t.line } },
			axisLabel: {
				color: t.ink,
				width: 130,
				overflow: 'truncate'
			}
		},
		series: [
			{
				type: 'bar',
				barMaxWidth: 18,
				itemStyle: { color: t.primary, borderRadius: [0, 3, 3, 0] },
				label: {
					show: true,
					position: 'right',
					color: t.ink,
					fontSize: 12,
					formatter: (p: { value: number }) => compactMoney(Math.round(p.value * 100))
				},
				data: rows.map((r) => euros(r.cents))
			}
		]
	};
}

export function balanceOption(
	points: { bucket: string; balanceCents: number }[],
	g: Granularity,
	t: ChartTheme
): EChartsCoreOption {
	const buckets = points.map((p) => p.bucket);
	return {
		...base(t),
		tooltip: {
			...base(t).tooltip,
			axisPointer: { type: 'line' },
			formatter: seriesTooltip(g, buckets)
		},
		grid: { ...grid, top: 12 },
		xAxis: categoryAxis(
			t,
			buckets.map((b) => formatBucket(b, g))
		),
		yAxis: { ...moneyAxis(t), scale: true },
		series: [
			{
				name: 'Closing balance',
				type: 'line',
				symbol: 'circle',
				symbolSize: 6,
				lineStyle: { color: t.primary, width: 2 },
				itemStyle: { color: t.primary },
				areaStyle: { color: t.primaryLight, opacity: 0.45 },
				data: points.map((p) => euros(p.balanceCents))
			}
		]
	};
}

export function trendTable(
	buckets: string[],
	series: { name: string; values: number[] }[],
	g: Granularity,
	caption: string
) {
	return {
		caption,
		head: ['Period', ...series.map((s) => s.name)],
		rows: buckets.map((b, i) => [
			formatBucket(b, g),
			...series.map((s) => formatMoney(s.values[i] ?? 0))
		])
	};
}
