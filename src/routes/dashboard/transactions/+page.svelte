<script lang="ts">
	import { resolve } from '$app/paths';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import { buildSearch } from '#lib/dashboard/filters.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const state = $derived(data.state);
	const result = $derived(data.result);
	const filterSearch = $derived(buildSearch(state));
	const href = (extra: Record<string, string>) =>
		`${resolve('/dashboard/transactions')}${buildSearch(state, extra)}`;
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

			{#if data.failed}
				<div class="notice notice-warn" role="alert">{data.failed}</div>
			{:else if result}
				<TransactionTable
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
