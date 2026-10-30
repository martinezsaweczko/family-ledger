<script lang="ts">
	import type { EChartsCoreOption } from 'echarts/core';
	import type { EChartsType } from '#lib/dashboard/echarts.ts';
	import { readTheme, type ChartTheme } from '#lib/dashboard/chart-theme.ts';

	/** Data table read by assistive tech instead of the picture (and by anyone who prefers numbers). */
	export interface ChartTable {
		caption: string;
		head: string[];
		rows: string[][];
	}

	interface Props {
		/** Builds the ECharts option from the live design tokens. */
		build: (theme: ChartTheme) => EChartsCoreOption;
		label: string;
		table?: ChartTable;
		height?: number;
		/** Called with the `data.slug` of a clicked mark, if it has one. */
		onpick?: (slug: string) => void;
	}
	let { build, label, table, height = 280, onpick }: Props = $props();

	let host = $state<HTMLDivElement>();
	let chart = $state.raw<EChartsType>();
	let ready = $state(false);

	$effect(() => {
		const el = host;
		if (!el) return;
		let dead = false;
		let instance: EChartsType | undefined;
		let observer: ResizeObserver | undefined;
		import('#lib/dashboard/echarts.ts').then(({ init }) => {
			if (dead) return;
			instance = init(el, undefined, { renderer: 'svg' });
			observer = new ResizeObserver(() => instance?.resize());
			observer.observe(el);
			chart = instance;
		});
		return () => {
			dead = true;
			observer?.disconnect();
			instance?.dispose();
			chart = undefined;
			ready = false;
		};
	});

	$effect(() => {
		const c = chart;
		if (!c) return;
		const theme = readTheme();
		const option = build(theme);
		c.off('click');
		if (onpick) {
			c.on('click', (e) => {
				const slug = (e.data as { slug?: string } | undefined)?.slug;
				if (slug) onpick(slug);
			});
		}
		c.setOption(
			{
				animation: theme.animate,
				textStyle: { fontFamily: theme.font, color: theme.inkSoft },
				...option
			},
			true
		);
		ready = true;
	});
</script>

<div
	bind:this={host}
	role="img"
	aria-label={label}
	data-chart-ready={ready ? 'true' : 'false'}
	class="w-full overflow-hidden"
	style:height="{height}px"
></div>

{#if table}
	<div class="sr-only">
		<table>
			<caption>{table.caption}</caption>
			<thead>
				<tr>
					{#each table.head as h (h)}<th scope="col">{h}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each table.rows as row, i (i)}
					<tr>
						{#each row as cell, j (j)}
							{#if j === 0}<th scope="row">{cell}</th>{:else}<td>{cell}</td>{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
