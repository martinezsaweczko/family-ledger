<script lang="ts">
	import { resolve } from '$app/paths';
	import CategoryIcon from '#lib/components/CategoryIcon.svelte';
	import Chart from '#lib/components/Chart.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import KpiCard from '#lib/components/KpiCard.svelte';
	import OverrideNotice from '#lib/components/OverrideNotice.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import { hbarOption, stackedOption, trendTable } from '#lib/dashboard/charts.ts';
	import { buildSearch } from '#lib/dashboard/filters.ts';
	import { kpiDelta, merchantInsight, trendInsight } from '#lib/dashboard/insights.ts';
	import { formatMoney } from '#lib/format/money.ts';
	import { formatPercent } from '#lib/format/number.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The category picker does not apply here: the page is already one category.
	const categories = $derived(data.categories);
	const state = $derived({
		...data.state,
		categoryIds: [],
		includeUncategorised: false
	});
	const filterSearch = $derived(buildSearch(state));
	const cat = $derived(data.category);
	const d = $derived(data.data);
	const g = $derived(state.granularity);
	const isIncome = $derived(d?.side === 'income');
	const pathname = $derived(resolve('/dashboard/category/[slug]', { slug: cat.slug }));
	const keep = $derived({
		...(data.q ? { q: data.q } : {}),
		...(data.sort !== 'date_desc' ? { sort: data.sort } : {})
	});
	const href = (extra: Record<string, string>) => `${pathname}${buildSearch(state, extra)}`;
	const deltaPct = $derived(isIncome ? d?.summary.delta?.incomePct : d?.summary.delta?.expensePct);
	const total = $derived(
		d?.stats?.totalCents ?? (isIncome ? d?.summary.incomeCents : d?.summary.expenseCents) ?? 0
	);
</script>

<svelte:head>
	<title>{cat.name} · Dashboard · Hearth</title>
</svelte:head>

<main id="content" class="mx-auto max-w-6xl px-5 py-8 sm:py-10">
	<nav aria-label="Breadcrumb" class="mb-3 text-sm text-ink-soft">
		<a
			class="underline underline-offset-4 hover:text-ink"
			href="{resolve('/dashboard')}{filterSearch}">Dashboard</a
		>
		<span aria-hidden="true"> / </span>
		<span>Category</span>
	</nav>
	<header class="mb-5 flex items-center gap-3">
		<CategoryIcon icon={cat.icon} slug={cat.slug} color={cat.color} size="lg" badge />
		<h1 class="text-3xl font-semibold">{cat.name}</h1>
		<span class="pill">{cat.kind}</span>
	</header>

	{#if !state.hasData}
		<section class="card px-6 py-14 text-center" data-testid="empty-state">
			<h2 class="text-xl font-semibold">No statements yet</h2>
			<a class="btn btn-primary mt-6" href={resolve('/admin')}>Import a statement</a>
		</section>
	{:else}
		<FilterBar {state} path={pathname} categories={data.categories} showCategories={false} {keep} />

		{#if data.failed}
			<div class="notice notice-warn mt-6" role="alert">{data.failed}</div>
		{:else if d}
			<section
				aria-labelledby="h-kpis"
				class="mt-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-4"
			>
				<h2 id="h-kpis" class="sr-only">Key figures</h2>
				<KpiCard
					testid="kpi-total"
					label={isIncome ? 'Total received' : 'Total spent'}
					value={formatMoney(total)}
					delta={kpiDelta(deltaPct ?? null, isIncome ? 'up' : 'down')}
					against="vs previous"
				/>
				<KpiCard
					testid="kpi-share"
					label={isIncome ? 'Share of income' : 'Share of spending'}
					value={d.stats ? formatPercent(Math.round(d.stats.sharePct) / 100) : '–'}
				/>
				<KpiCard
					testid="kpi-avg"
					label="Average per month"
					value={d.stats ? formatMoney(d.stats.avgPerMonthCents) : '–'}
				/>
				<KpiCard testid="kpi-count" label="Transactions" value={String(d.stats?.count ?? 0)} />
			</section>

			<div class="mt-6 grid gap-4 lg:grid-cols-2">
				<section
					class="card p-5 {d.side === 'expense' ? '' : 'lg:col-span-2'}"
					aria-labelledby="h-trend"
				>
					<h2 id="h-trend" class="text-base font-semibold">Over time</h2>
					<p class="mt-1 text-sm text-ink-soft">
						{trendInsight(d.buckets, d.trend?.values ?? [], g) ?? 'Nothing booked in this period.'}
					</p>
					{#if d.trend}
						{@const series = d.trend}
						<div class="mt-3" data-testid="chart-category-trend">
							<Chart
								label="{cat.name} per {g}"
								height={280}
								build={(t) =>
									stackedOption(
										d.buckets,
										[{ name: series.name, color: cat.color, values: series.values }],
										g,
										t
									)}
								table={trendTable(d.buckets, [series], g, `${cat.name} per period`)}
							/>
						</div>
					{/if}
				</section>

				{#if d.side === 'expense'}
					<section class="card p-5" aria-labelledby="h-merch">
						<h2 id="h-merch" class="text-base font-semibold">Top merchants</h2>
						<p class="mt-1 text-sm text-ink-soft">
							{merchantInsight(d.merchants[0], total) ?? 'No expenses in this period.'}
						</p>
						{#if d.merchants.length}
							<div class="mt-3" data-testid="chart-category-merchants">
								<Chart
									label="Top merchants in {cat.name}"
									height={Math.max(220, d.merchants.length * 36 + 16)}
									build={(t) =>
										hbarOption(
											d.merchants.map((m) => ({ label: m.merchant, cents: m.totalCents })),
											t
										)}
									table={{
										caption: `Top merchants in ${cat.name}`,
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
				{/if}

				<section class="card p-5 lg:col-span-2" aria-labelledby="h-tx">
					<h2 id="h-tx" class="text-base font-semibold">Transactions</h2>
					<form
						method="GET"
						action={pathname}
						class="my-3 flex flex-wrap items-end gap-3"
						role="search"
					>
						{#each [...new URLSearchParams(filterSearch)] as [k, v] (k)}
							<input type="hidden" name={k} value={v} />
						{/each}
						{#if data.sort !== 'date_desc'}<input
								type="hidden"
								name="sort"
								value={data.sort}
							/>{/if}
						<div class="min-w-56 flex-1">
							<label class="label" for="q">Search description</label>
							<input id="q" name="q" type="search" class="field" value={data.q} />
						</div>
						<button class="btn" type="submit">Search</button>
					</form>
					<OverrideNotice {form} />
					<TransactionTable
						{categories}
						rows={d.rows.rows}
						sort={data.sort}
						sortHref={(s) => href({ ...(data.q ? { q: data.q } : {}), sort: s })}
						search={filterSearch}
					/>
					<div class="mt-4">
						<Pager
							page={d.rows.page}
							pageSize={d.rows.pageSize}
							total={d.rows.total}
							href={(p) => href({ ...keep, page: String(p) })}
						/>
					</div>
				</section>
			</div>
		{/if}
	{/if}
</main>
