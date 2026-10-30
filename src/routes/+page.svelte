<script lang="ts">
	import { formatMoney } from '#lib/format/money.ts';

	const summary = [
		{ label: 'Net worth', cents: 18432000, hint: '+2.4% this month', tone: 'up' },
		{ label: 'Spent this month', cents: 214530, hint: '68% of budget', tone: 'flat' },
		{ label: 'Saved this month', cents: 96000, hint: 'Goal: €1,200', tone: 'up' }
	];
</script>

<svelte:head>
	<title>Hearth · Family finances</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-5 py-10 sm:py-16">
	<header class="mb-10">
		<p class="text-sm font-medium tracking-widest text-primary-600 uppercase">Hearth</p>
		<h1 class="mt-2 text-4xl font-semibold sm:text-5xl">Your family's money, calmly in view.</h1>
		<p class="mt-3 max-w-xl text-ink-soft">
			Budgets, goals and shared expenses in one warm, clear place.
		</p>
	</header>

	<section class="grid gap-4 sm:grid-cols-3" aria-label="Summary">
		{#each summary as item (item.label)}
			<article class="rounded-card border border-line bg-card p-6 shadow-card">
				<h2 class="font-sans text-sm font-medium text-ink-soft">{item.label}</h2>
				<p class="num mt-2 font-display text-3xl font-semibold">{formatMoney(item.cents)}</p>
				<p
					class="mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium {item.tone === 'up'
						? 'bg-primary-50 text-primary-700'
						: 'bg-attention-100 text-ink'}"
				>
					{item.hint}
				</p>
			</article>
		{/each}
	</section>
</main>
