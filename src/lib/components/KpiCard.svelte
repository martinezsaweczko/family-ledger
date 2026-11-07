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
		good: 'text-primary-700',
		bad: 'text-attention-600',
		neutral: 'text-ink-soft'
	};
</script>

<article class="card flex h-full flex-col p-4 sm:p-5" data-testid={testid}>
	<h3 class="font-sans text-[13px] font-medium text-ink-soft">
		{label}
	</h3>
	<p
		class="num mt-1.5 font-display text-xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] min-[400px]:text-2xl sm:text-[1.65rem]"
		data-kpi-value
	>
		{value}
	</p>
	{#if delta}
		<p
			class="num mt-auto flex flex-wrap items-center gap-x-1.5 pt-2.5 text-xs font-medium {tone[
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
			<span class="font-normal text-ink-soft">{against}</span>
		</p>
	{/if}
	{#if hint}<p class="mt-auto pt-2.5 text-xs text-ink-soft">{hint}</p>{/if}
</article>
