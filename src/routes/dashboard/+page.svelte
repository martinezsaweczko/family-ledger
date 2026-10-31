<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import Chart from '#lib/components/Chart.svelte';
	import CategoryChip from '#lib/components/CategoryChip.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import KpiCard from '#lib/components/KpiCard.svelte';
	import {
		balanceOption,
		donutOption,
		hbarOption,
		incomeExpenseOption,
		stackedOption,
		trendTable
	} from '#lib/dashboard/charts.ts';
	import { buildSearch } from '#lib/dashboard/filters.ts';
	import {
		balanceInsight,
		changeInsight,
		contributionInsight,
		formatBucket,
		kpiDelta,
		merchantInsight,
		pointsDelta,
		recurringInsight,
		topCategoryInsight,
		trendInsight,
		type KpiDelta
	} from '#lib/dashboard/insights.ts';
	import { formatDate } from '#lib/format/date.ts';
	import { formatMoney } from '#lib/format/money.ts';
	import { formatPercent } from '#lib/format/number.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const state = $derived(data.state);
	const d = $derived(data.data);
	const search = $derived(buildSearch(state));
	const g = $derived(state.granularity);

	const sum = $derived(d?.summary);
	const kpis = $derived.by(() => {
		if (!sum) return [];
		const prev = sum.previous;
		const balPct =
			sum.latestBalanceCents !== null && d?.previousBalanceCents
				? (sum.latestBalanceCents - d.previousBalanceCents) / Math.abs(d.previousBalanceCents)
				: null;
		const rows: { label: string; value: string; delta: KpiDelta | null; id: string }[] = [
			{
				id: 'income',
				label: 'Income',
				value: formatMoney(sum.incomeCents),
				delta: kpiDelta(sum.delta?.incomePct ?? null, 'up')
			},
			{
				id: 'expenses',
				label: 'Expenses',
				value: formatMoney(sum.expenseCents),
				delta: kpiDelta(sum.delta?.expensePct ?? null, 'down')
			},
			{
				id: 'net',
				label: 'Net saved',
				value: formatMoney(sum.netCents),
				delta: kpiDelta(sum.delta?.netPct ?? null, 'up')
			},
			{
				id: 'savings-rate',
				label: 'Savings rate',
				value:
					sum.savingsRate === null ? '–' : formatPercent(Math.round(sum.savingsRate * 100) / 100),
				delta: pointsDelta(sum.savingsRate, prev?.savingsRate ?? null)
			},
			{
				id: 'balance',
				label: 'Current balance',
				value: sum.latestBalanceCents === null ? '–' : formatMoney(sum.latestBalanceCents),
				delta: kpiDelta(balPct, 'up')
			}
		];
		return rows;
	});

	// Donut: top 7 categories + the rest as one neutral slice; the list below shows all of them.
	const expense = $derived(d?.breakdown.expense ?? []);
	const slices = $derived.by(() => {
		const top = expense.slice(0, 7).map((c) => ({
			name: c.name,
			slug: c.slug,
			color: c.color,
			totalCents: c.totalCents
		}));
		const rest = expense.slice(7).reduce((n, c) => n + c.totalCents, 0);
		return rest > 0
			? [...top, { name: 'Other categories', slug: null, color: '', totalCents: rest }]
			: top;
	});
	const uncategorised = $derived.by(() => {
		const rows = [...(d?.breakdown.expense ?? []), ...(d?.breakdown.income ?? [])].filter(
			(c) => c.categoryId === null
		);
		return {
			count: rows.reduce((n, c) => n + c.count, 0),
			cents: rows.reduce((n, c) => n + c.totalCents, 0)
		};
	});
	const trendTotals = $derived(
		(d?.trend.buckets ?? []).map((_, i) => d!.trend.series.reduce((n, s) => n + s.values[i], 0))
	);
	const commitment = $derived(
		(d?.recurring ?? []).reduce((n, r) => n + r.estimatedMonthlyCents, 0)
	);
	const people = $derived(d?.people.people ?? []);
	// Stable colour per person (alphabetical), independent of who contributes more this period.
	const personSeries = $derived(
		people.map((p) => ({
			name: p.name,
			values: p.values,
			color: '',
			neutral: p.personId === null,
			slot: [...people]
				.map((x) => x.name)
				.sort()
				.indexOf(p.name)
		}))
	);
	const balance = $derived(d?.balance ?? []);

	// The banner counts the rows of the CURRENT range, so its link keeps that range (and the
	// transfers toggle) and only swaps the category selection for "uncategorised".
	const fixHref = $derived(
		`${resolve('/dashboard/transactions')}${buildSearch({
			...state,
			categoryIds: [],
			includeUncategorised: true
		})}`
	);

	const pick = (slug: string) =>
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus the filter query string
		goto(`${resolve('/dashboard/category/[slug]', { slug })}${search}`);
	const pct = (n: number) => formatPercent(Math.round(n) / 100);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href is built from resolve() plus a query string -->

<svelte:head>
	<title>Dashboard · Hearth</title>
</svelte:head>

<main id="content" class="mx-auto max-w-6xl px-5 py-8 sm:py-10">
	<header class="mb-5">
		<h1 class="text-3xl font-semibold">Dashboard</h1>
		<p class="mt-1 text-ink-soft">Where the joint account's money comes from and where it goes.</p>
	</header>

	{#if !state.hasData}
		<section class="card mt-6 px-6 py-14 text-center" data-testid="empty-state">
			<h2 class="text-xl font-semibold">No statements yet</h2>
			<p class="mx-auto mt-2 max-w-md text-ink-soft">
				Import a bank export and the dashboard fills in: income, expenses, categories and who
				contributes what.
			</p>
			<a class="btn btn-primary mt-6" href={resolve('/admin')}>Import a statement</a>
		</section>
	{:else}
		<FilterBar {state} path={resolve('/dashboard')} categories={data.categories} />

		{#if data.failed}
			<div class="notice notice-warn mt-6" role="alert">
				<p class="font-medium">The dashboard could not load its numbers.</p>
				<p class="mt-1">{data.failed}</p>
				<a class="btn mt-3" href={resolve('/dashboard') + search}>Try again</a>
			</div>
		{:else if d && sum}
			{#if uncategorised.count > 0}
				<div
					class="notice notice-warn mt-6 flex flex-wrap items-center justify-between gap-3"
					data-testid="uncategorised-banner"
				>
					<p>
						<strong class="num">{uncategorised.count}</strong>
						{uncategorised.count === 1 ? 'transaction' : 'transactions'}
						(<span class="num">{formatMoney(uncategorised.cents)}</span>) are uncategorised. They
						skew the charts below.
					</p>
					<div class="flex flex-wrap gap-2">
						<a class="btn btn-primary" href={fixHref} data-testid="fix-uncategorised"
							>Categorise them</a
						>
						<a class="btn" href={resolve('/admin/review')}>Review queue</a>
					</div>
				</div>
			{/if}

			<section
				aria-labelledby="h-kpis"
				class="mt-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-5"
			>
				<h2 id="h-kpis" class="sr-only">Key figures</h2>
				{#each kpis as k (k.id)}
					<div class={k.id === 'balance' ? 'min-[400px]:col-span-2 lg:col-span-1' : ''}>
						<KpiCard
							label={k.label}
							value={k.value}
							delta={k.delta}
							testid="kpi-{k.id}"
							against={k.id === 'balance' ? 'vs period start' : 'vs previous'}
						/>
					</div>
				{/each}
			</section>

			<div class="mt-6 grid gap-4 lg:grid-cols-2">
				<section class="card p-5 lg:col-span-2" aria-labelledby="h-flow">
					<h2 id="h-flow" class="text-base font-semibold">Income vs expenses</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{changeInsight('Expenses', sum.delta?.expensePct ?? null) ??
							'Per period, with the net result as a line.'}
					</p>
					<div class="mt-3" data-testid="chart-flow">
						<Chart
							label="Income, expenses and net saved per {g}"
							build={(t) => incomeExpenseOption(d.series, g, t)}
							table={{
								caption: 'Income, expenses and net per period',
								head: ['Period', 'Income', 'Expenses', 'Net'],
								rows: d.series.map((r) => [
									formatBucket(r.bucket, g),
									formatMoney(r.incomeCents),
									formatMoney(r.expenseCents),
									formatMoney(r.netCents)
								])
							}}
						/>
					</div>
				</section>

				<section class="card p-5" aria-labelledby="h-cat">
					<h2 id="h-cat" class="text-base font-semibold">Spending by category</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{topCategoryInsight(expense) ?? 'No expenses in this period.'}
					</p>
					{#if expense.length}
						<div class="mt-3" data-testid="chart-categories">
							<Chart
								label="Share of spending by category"
								height={240}
								build={(t) => donutOption(slices, t)}
								onpick={pick}
								table={{
									caption: 'Spending by category',
									head: ['Category', 'Spent', 'Share'],
									rows: expense.map((c) => [c.name, formatMoney(c.totalCents), pct(c.sharePct)])
								}}
							/>
						</div>
						<ol class="mt-3 divide-y divide-line text-sm" data-testid="category-list">
							{#each expense as c (c.categoryId ?? 'none')}
								<li class="flex items-center justify-between gap-3 py-2">
									<CategoryChip
										name={c.name}
										color={c.categoryId === null ? null : c.color}
										slug={c.slug}
										icon={c.icon}
										{search}
										href={c.categoryId === null ? fixHref : undefined}
									/>
									<span class="num flex shrink-0 items-baseline gap-3">
										<span class="text-ink-soft">{pct(c.sharePct)}</span>
										<span class="w-24 text-right font-medium">{formatMoney(c.totalCents)}</span>
									</span>
								</li>
							{/each}
						</ol>
					{/if}
				</section>

				<section class="card p-5" aria-labelledby="h-merch">
					<h2 id="h-merch" class="text-base font-semibold">Top merchants</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{merchantInsight(d.merchants[0], sum.expenseCents) ?? 'No expenses in this period.'}
					</p>
					{#if d.merchants.length}
						<div class="mt-3" data-testid="chart-merchants">
							<Chart
								label="Top merchants by spend"
								height={Math.max(220, d.merchants.length * 36 + 16)}
								build={(t) =>
									hbarOption(
										d.merchants.map((m) => ({ label: m.merchant, cents: m.totalCents })),
										t
									)}
								table={{
									caption: 'Top merchants by spend',
									head: ['Merchant', 'Spent', 'Charges'],
									rows: d.merchants.map((m) => [
										m.merchant,
										formatMoney(m.totalCents),
										String(m.count)
									])
								}}
							/>
						</div>
					{/if}
				</section>

				<section class="card p-5 lg:col-span-2" aria-labelledby="h-trend">
					<h2 id="h-trend" class="text-base font-semibold">Category trend</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{trendInsight(d.trend.buckets, trendTotals, g) ??
							'How much each of the biggest categories costs over time.'}
					</p>
					<div class="mt-3" data-testid="chart-trend">
						<Chart
							label="Spending per {g} for the top categories"
							height={320}
							build={(t) =>
								stackedOption(
									d.trend.buckets,
									d.trend.series.map((s) => ({
										name: s.name,
										color: s.color,
										values: s.values,
										neutral: s.categoryId === null
									})),
									g,
									t
								)}
							table={trendTable(
								d.trend.buckets,
								d.trend.series,
								g,
								'Spending per period by category'
							)}
						/>
					</div>
				</section>

				<section class="card p-5" aria-labelledby="h-people">
					<h2 id="h-people" class="text-base font-semibold">Who puts money in</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{contributionInsight(people) ?? 'No attributed income in this period.'}
					</p>
					{#if people.length}
						<div class="mt-3" data-testid="chart-people">
							<Chart
								label="Income contributed by each person per {g}"
								height={240}
								build={(t) =>
									stackedOption(
										d.people.buckets,
										personSeries.map((p) => ({
											...p,
											color: p.slot === 0 ? t.primary : t.highlight
										})),
										g,
										t
									)}
								table={trendTable(d.people.buckets, d.people.people, g, 'Income by person')}
							/>
						</div>
						<ul class="mt-3 divide-y divide-line text-sm" data-testid="people-list">
							{#each people as p (p.personId ?? 'none')}
								<li class="flex items-center justify-between py-2">
									<span class="font-medium">{p.name}</span>
									<span class="num flex gap-3">
										<span class="text-ink-soft">{pct(p.sharePct)}</span>
										<span class="w-24 text-right font-medium">{formatMoney(p.totalCents)}</span>
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="card p-5" aria-labelledby="h-balance">
					<h2 id="h-balance" class="text-base font-semibold">Balance over time</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{balanceInsight(
							balance[0]?.balanceCents ?? null,
							balance.at(-1)?.balanceCents ?? null
						) ?? 'No balance information in this period.'}
					</p>
					{#if balance.length}
						<div class="mt-3" data-testid="chart-balance">
							<Chart
								label="Account balance at the end of each {g}"
								height={280}
								build={(t) => balanceOption(balance, g, t)}
								table={{
									caption: 'Closing balance per period',
									head: ['Period', 'Balance'],
									rows: balance.map((b) => [formatBucket(b.bucket, g), formatMoney(b.balanceCents)])
								}}
							/>
						</div>
					{/if}
				</section>

				<section class="card p-5 lg:col-span-2" aria-labelledby="h-rec">
					<h2 id="h-rec" class="text-base font-semibold">Recurring and subscriptions</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{recurringInsight(d.recurring.length, commitment) ??
							'No recurring monthly charges found in the last 12 months.'}
					</p>
					{#if d.recurring.length}
						<div class="mt-3 overflow-x-auto" data-testid="recurring-list">
							<table class="w-full text-left text-sm">
								<thead class="border-b border-line text-xs text-ink-soft">
									<tr>
										<th scope="col" class="py-2 pr-3 font-medium">Merchant</th>
										<th scope="col" class="hidden py-2 pr-3 font-medium sm:table-cell"
											>Last charge</th
										>
										<th scope="col" class="hidden py-2 pr-3 text-right font-medium sm:table-cell"
											>Charges</th
										>
										<th scope="col" class="py-2 text-right font-medium">Per month</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-line">
									{#each d.recurring as r (r.merchant)}
										<tr>
											<td class="py-2.5 pr-3 font-medium">{r.merchant}</td>
											<td class="num hidden py-2.5 pr-3 text-ink-soft sm:table-cell"
												>{formatDate(r.lastDate)}</td
											>
											<td class="num hidden py-2.5 pr-3 text-right text-ink-soft sm:table-cell"
												>{r.occurrences}</td
											>
											<td class="num py-2.5 text-right font-medium"
												>{formatMoney(r.estimatedMonthlyCents)}</td
											>
										</tr>
									{/each}
								</tbody>
								<tfoot class="border-t border-line">
									<tr>
										<th scope="row" class="py-2.5 pr-3 font-semibold">Monthly commitment</th>
										<td class="hidden sm:table-cell"></td>
										<td class="hidden sm:table-cell"></td>
										<td class="num py-2.5 text-right font-semibold" data-testid="commitment"
											>{formatMoney(commitment)}</td
										>
									</tr>
								</tfoot>
							</table>
						</div>
					{/if}
				</section>
			</div>

			<p class="mt-6 text-sm text-ink-soft">
				<a
					class="font-medium text-primary-700 underline underline-offset-4"
					href="{resolve('/dashboard/transactions')}{search}">Browse all transactions</a
				>
			</p>
		{/if}
	{/if}
</main>
