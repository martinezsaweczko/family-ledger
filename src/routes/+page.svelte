<script lang="ts">
	import { resolve } from '$app/paths';
	import MiniBars from '#lib/components/MiniBars.svelte';
	import { formatBucket } from '#lib/dashboard/insights.ts';
	import { formatDate, formatMonthYear } from '#lib/format/date.ts';
	import { formatMoney } from '#lib/format/money.ts';
	import { formatPercent } from '#lib/format/number.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const live = $derived(data.live);

	const monthName = (iso: string) => formatMonthYear(iso, 'long');

	// Clearly labelled sample shown only until the first statement is imported.
	const sample = [
		[3600, 2300],
		[3600, 2500],
		[3700, 2200],
		[3600, 2900],
		[3700, 2400],
		[3600, 2100]
	].map(([i, e], n) => ({
		label: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'][n],
		incomeCents: i * 100,
		expenseCents: e * 100
	}));
	const months = $derived(
		live ? live.months.map((m) => ({ ...m, label: formatBucket(m.bucket, 'month') })) : sample
	);

	const features = [
		{
			title: 'Import any statement',
			body: 'Drop the bank export on the admin page. The format is detected for you, and Deutsche Bank is supported today.',
			icon: 'M12 3v12m0 0-4-4m4 4 4-4M5 19h14'
		},
		{
			title: 'Smart de-duplication',
			body: 'Overlapping exports and re-uploads never count a movement twice. Your raw rows stay untouched.',
			icon: 'M8 7h10v12H8zM6 17H4V5h10v2'
		},
		{
			title: 'Categories and rules',
			body: 'Rules sort the routine spending. Review the rest once, teach a rule, and it applies from then on.',
			icon: 'M4 6h16M4 12h10M4 18h6'
		},
		{
			title: 'Insights that answer questions',
			body: 'How much goes on the car, which subscriptions run every month, and who puts what into the joint account.',
			icon: 'M4 19V9m6 10V5m6 14v-7m4 7H2'
		}
	];
</script>

<svelte:head>
	<title>Hearth · David & Joanna's household finance</title>
	<meta
		name="description"
		content="Hearth turns the joint account's bank statements into a clear picture of income, spending and contributions."
	/>
</svelte:head>

<main id="content">
	<section class="border-b border-line bg-card">
		<div
			class="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14"
		>
			<div>
				<p class="text-sm font-semibold tracking-widest text-primary-600 uppercase">
					David & Joanna's household finance
				</p>
				<h1 class="mt-4 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl">
					One joint account. Two people. A clear picture.
				</h1>
				<p class="mt-5 max-w-xl text-lg text-ink-soft">
					Hearth reads the bank statement, sorts every movement and shows where the money comes
					from, where it goes and who put it in. It runs on your own network.
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<a class="btn btn-primary" href={resolve('/dashboard')}>Open the dashboard</a>
					<a class="btn" href={resolve('/admin')}>Import a statement</a>
				</div>
			</div>

			<section aria-labelledby="live-h" class="card p-5 sm:p-6" data-testid="live-panel">
				{#if live}
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<h2 id="live-h" class="text-sm font-semibold">Right now</h2>
						<p class="text-xs text-ink-soft">{monthName(live.monthStart)} so far</p>
					</div>
					<p class="mt-4 text-sm text-ink-soft">
						Current balance{live.balanceDate ? ` · as of ${formatDate(live.balanceDate)}` : ''}
					</p>
					<p class="num font-display text-4xl font-semibold sm:text-5xl" data-testid="live-balance">
						{live.balanceCents === null ? '–' : formatMoney(live.balanceCents)}
					</p>
					<dl class="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-4 min-[480px]:grid-cols-3">
						<div>
							<dt class="text-xs text-ink-soft">Income</dt>
							<dd class="num mt-1 font-semibold" data-testid="live-income">
								{formatMoney(live.incomeCents)}
							</dd>
						</div>
						<div>
							<dt class="text-xs text-ink-soft">Expenses</dt>
							<dd class="num mt-1 font-semibold" data-testid="live-expenses">
								{formatMoney(live.expenseCents)}
							</dd>
						</div>
						<div>
							<dt class="text-xs text-ink-soft">Savings rate</dt>
							<dd class="num mt-1 font-semibold" data-testid="live-rate">
								{live.savingsRate === null
									? '–'
									: formatPercent(Math.round(live.savingsRate * 100) / 100)}
							</dd>
						</div>
					</dl>
				{:else}
					<h2 id="live-h" class="text-sm font-semibold">Nothing imported yet</h2>
					<p class="mt-2 text-ink-soft" data-testid="landing-empty">
						{data.failed
							? 'The numbers could not be loaded right now.'
							: 'Import your first statement and this panel shows the live balance, the month so far and the savings rate.'}
					</p>
					<a class="btn btn-primary mt-4" href={resolve('/admin')}>Import a statement</a>
				{/if}

				<div class="mt-6 border-t border-line pt-4">
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<p class="text-xs font-medium text-ink-soft">
							{live ? 'Income and expenses, last 12 months' : 'Sample illustration, not your data'}
						</p>
						<p class="flex gap-3 text-xs text-ink-soft">
							<span class="inline-flex items-center gap-1.5"
								><span class="size-2 rounded-sm bg-primary-500"></span>Income</span
							>
							<span class="inline-flex items-center gap-1.5"
								><span class="size-2 rounded-sm bg-attention-500"></span>Expenses</span
							>
						</p>
					</div>
					<div data-testid="landing-chart">
						<MiniBars
							{months}
							label={live
								? 'Income and expenses for each of the last months'
								: 'Sample illustration of monthly income and expenses'}
						/>
					</div>
				</div>
			</section>
		</div>
	</section>

	<section class="mx-auto max-w-6xl px-5 py-14 sm:py-20" aria-labelledby="features-h">
		<h2 id="features-h" class="max-w-2xl text-3xl font-semibold text-balance">
			From a spreadsheet export to an answer in a minute.
		</h2>
		<ul class="mt-10 grid gap-x-12 sm:grid-cols-2">
			{#each features as f (f.title)}
				<li class="flex gap-4 border-t border-line py-6">
					<svg
						viewBox="0 0 24 24"
						class="mt-0.5 size-6 shrink-0 text-primary-600"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"><path d={f.icon} /></svg
					>
					<div>
						<h3 class="text-base font-semibold">{f.title}</h3>
						<p class="mt-1 text-ink-soft">{f.body}</p>
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<section class="bg-band text-on-band">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-12">
			<div class="max-w-xl">
				<h2 class="text-2xl font-semibold">Start with one statement.</h2>
				<p class="mt-2 text-on-band-soft">
					Import this month's export, then open the dashboard. Do it again next month; nothing is
					ever counted twice.
				</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<a
					class="btn border-on-band bg-on-band text-band hover:bg-on-band/90"
					href={resolve('/admin')}>Import a statement</a
				>
				<a
					class="btn border-on-band-soft bg-transparent text-on-band hover:bg-on-band/10"
					href={resolve('/dashboard')}>Open the dashboard</a
				>
			</div>
		</div>
	</section>
</main>

<footer class="border-t border-line bg-card">
	<div
		class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-sm text-ink-soft"
	>
		<p>
			<span class="font-semibold text-primary-600">Hearth</span> · David & Joanna's household finance
		</p>
		<p>Runs on your own network. No accounts, no cloud.</p>
	</div>
</footer>
