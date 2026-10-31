<script lang="ts">
	import { untrack } from 'svelte';
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
	/** Bumped whenever the effective theme changes, so the option is rebuilt with fresh token colours. */
	let themeTick = $state(0);
	let scheme = $state<string>();

	$effect(() => {
		const bump = () => themeTick++;
		const mutations = new MutationObserver(bump);
		mutations.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'data-theme-pref']
		});
		// Covers System mode before/without the attribute being rewritten, and the reduced-motion flag.
		const queries = [
			matchMedia('(prefers-color-scheme: dark)'),
			matchMedia('(prefers-reduced-motion: reduce)')
		];
		for (const q of queries) q.addEventListener('change', bump);
		return () => {
			mutations.disconnect();
			for (const q of queries) q.removeEventListener('change', bump);
		};
	});

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
		void themeTick;
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
				// Re-theming must not replay the entrance animation.
				animation: theme.animate && !untrack(() => ready),
				textStyle: { fontFamily: theme.font, color: theme.inkSoft },
				...option
			},
			true
		);
		scheme = theme.scheme;
		ready = true;
	});
</script>

<div
	bind:this={host}
	role="img"
	aria-label={label}
	data-chart-ready={ready ? 'true' : 'false'}
	data-chart-scheme={scheme}
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
