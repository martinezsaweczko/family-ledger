<script lang="ts">
	import type { KpiDelta } from '#lib/dashboard/insights.ts';

	interface Props {
		label: string;
		value: string;
		delta?: KpiDelta | null;
		/** What the delta is measured against, e.g. "vs previous period". */
		against?: string;
		hint?: string;
		testid?: string;
	}
	let {
		label,
		value,
		delta = null,
		against = 'vs previous period',
		hint,
		testid
	}: Props = $props();

	const tone = {
		good: 'bg-primary-50 text-primary-700',
		bad: 'bg-attention-100 text-ink',
		neutral: 'bg-paper text-ink-soft'
	};
</script>

<article class="card p-4 sm:p-5" data-testid={testid}>
	<h3 class="font-sans text-sm font-medium text-ink-soft">{label}</h3>
	<p class="num mt-1 font-display text-2xl font-semibold sm:text-[1.65rem]" data-kpi-value>
		{value}
	</p>
	{#if delta}
		<p
			class="num mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {tone[
				delta.tone
			]}"
		>
			<svg viewBox="0 0 12 12" class="size-3" aria-hidden="true" fill="none" stroke="currentColor">
				{#if delta.dir === 'up'}
					<path d="M6 10V2m0 0L2.5 5.5M6 2l3.5 3.5" stroke-width="1.6" stroke-linecap="round" />
				{:else if delta.dir === 'down'}
					<path d="M6 2v8m0 0L2.5 6.5M6 10l3.5-3.5" stroke-width="1.6" stroke-linecap="round" />
				{:else}
					<path d="M2.5 6h7" stroke-width="1.6" stroke-linecap="round" />
				{/if}
			</svg>
			<span>{delta.text}</span>
			<span class="font-normal">{against}</span>
		</p>
	{/if}
	{#if hint}<p class="mt-2 text-xs text-ink-soft">{hint}</p>{/if}
</article>
