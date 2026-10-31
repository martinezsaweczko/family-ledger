<script lang="ts">
	import { resolve } from '$app/paths';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import OverrideNotice from '#lib/components/OverrideNotice.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import { buildSearch } from '#lib/dashboard/filters.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const categories = $derived(data.categories);
	const state = $derived(data.state);
	const result = $derived(data.result);
	const filterSearch = $derived(buildSearch(state));
	const href = (extra: Record<string, string>) =>
		`${resolve('/dashboard/transactions')}${buildSearch(state, extra)}`;
	// "Only uncategorised" = the fix-them-fast view: nothing else narrows it.
	const onlyUncategorised = $derived(
		state.includeUncategorised &&
			state.categoryIds.length === 0 &&
			state.source === 'any' &&
			data.q === ''
	);
	const uncategorisedHref = $derived(
		`${resolve('/dashboard/transactions')}${buildSearch(
			{ ...state, categoryIds: [], includeUncategorised: true, source: 'any' },
			{
				...(data.q ? { q: data.q } : {}),
				...(data.sort !== 'date_desc' ? { sort: data.sort } : {})
			}
		)}`
	);
	const allHref = $derived(
		`${resolve('/dashboard/transactions')}${buildSearch({ ...state, categoryIds: [], includeUncategorised: false, source: 'any' })}`
	);
	const keep = $derived({
		...(data.q ? { q: data.q } : {}),
		...(data.sort !== 'date_desc' ? { sort: data.sort } : {})
	});
</script>

<svelte:head>
	<title>Transactions · Hearth</title>
</svelte:head>

<main id="content" class="mx-auto max-w-6xl px-5 py-8 sm:py-10">
	<header class="mb-5">
		<h1 class="text-3xl font-semibold">Transactions</h1>
		<p class="mt-1 text-ink-soft">
			Every movement in the selected period. Search, sort and filter.
		</p>
	</header>

	{#if !state.hasData}
		<section class="card px-6 py-14 text-center" data-testid="empty-state">
			<h2 class="text-xl font-semibold">No statements yet</h2>
			<p class="mx-auto mt-2 max-w-md text-ink-soft">
				Import a bank export to see transactions here.
			</p>
			<a class="btn btn-primary mt-6" href={resolve('/admin')}>Import a statement</a>
		</section>
	{:else}
		<FilterBar
			{state}
			path={resolve('/dashboard/transactions')}
			categories={data.categories}
			{keep}
			showSource
		/>

		<section class="card mt-6 p-5" aria-label="Transactions">
			<form
				method="GET"
				action={resolve('/dashboard/transactions')}
				class="mb-4 flex flex-wrap items-end gap-3"
				role="search"
			>
				{#each Object.entries(Object.fromEntries(new URLSearchParams(filterSearch))) as [k, v] (k)}
					<input type="hidden" name={k} value={v} />
				{/each}
				{#if data.sort !== 'date_desc'}<input type="hidden" name="sort" value={data.sort} />{/if}
				<div class="min-w-56 flex-1">
					<label class="label" for="q">Search description</label>
					<input
						id="q"
						name="q"
						type="search"
						class="field"
						value={data.q}
						placeholder="e.g. Mercadona…"
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				<button class="btn" type="submit">Search</button>
			</form>

			<OverrideNotice {form} />

			{#if !data.failed && data.uncategorisedCount > 0}
				<p class="mb-3 text-sm" data-testid="uncategorised-count" aria-live="polite">
					{#if onlyUncategorised}
						<span class="pill pill-warn"
							><span class="num">{data.uncategorisedCount}</span>&nbsp;left to categorise</span
						>
					{:else}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the filter query string -->
						<a
							href={uncategorisedHref}
							class="pill pill-warn relative underline underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
							><span class="num">{data.uncategorisedCount}</span>&nbsp;uncategorised in this period.
							Show only those</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</p>
			{/if}

			{#if data.failed}
				<div class="notice notice-warn" role="alert">{data.failed}</div>
			{:else if result && onlyUncategorised && result.total === 0}
				<div class="px-4 py-12 text-center" data-testid="all-caught-up">
					<h2 class="text-xl font-semibold">All caught up</h2>
					<p class="mx-auto mt-2 max-w-md text-ink-soft">
						Every transaction in this period has a category. Nice work.
					</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus the filter query string -->
					<a class="btn mt-6" href={allHref}>Show all transactions</a>
				</div>
			{:else if result}
				<TransactionTable
					{categories}
					rows={result.rows}
					sort={data.sort}
					sortHref={(s) => href({ ...(data.q ? { q: data.q } : {}), sort: s })}
					search={filterSearch}
				/>
				<div class="mt-4">
					<Pager
						page={result.page}
						pageSize={result.pageSize}
						total={result.total}
						href={(p) => href({ ...keep, page: String(p) })}
					/>
				</div>
			{/if}
		</section>
	{/if}
</main>
