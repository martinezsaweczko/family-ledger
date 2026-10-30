<script lang="ts">
	import {
		GRANULARITIES,
		PRESETS,
		buildSearch,
		type FilterState,
		type PresetId
	} from '#lib/dashboard/filters.ts';
	import { formatRange } from '#lib/dashboard/insights.ts';

	interface Option {
		id: number;
		name: string;
		color: string;
		kind: string;
	}
	interface Props {
		state: FilterState;
		/** Already resolved path of the current page. */
		path: string;
		categories: Option[];
		/** Extra params preserved across filter changes (search, sort...). */
		keep?: Record<string, string>;
		/** Hide the category picker (e.g. on a category page). */
		showCategories?: boolean;
	}
	let { state, path, categories, keep = {}, showCategories = true }: Props = $props();

	const base = $derived(path);
	const presetHref = (id: Exclude<PresetId, 'custom'>) =>
		`${base}${buildSearch({ ...state, preset: id }, keep)}`;
	const selected = $derived(new Set(state.categoryIds));
	const pickable = $derived(categories.filter((c) => c.kind === 'expense' || c.kind === 'income'));
	const catSummary = $derived(
		selected.size === 0
			? 'All categories'
			: selected.size === 1
				? (categories.find((c) => selected.has(c.id))?.name ?? '1 category')
				: `${selected.size} categories`
	);
	const filtersActive = $derived(selected.size > 0 || state.includeTransfers);
	const resetHref = $derived(
		`${base}${buildSearch({ ...state, categoryIds: [], includeTransfers: false }, keep)}`
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href is built from resolve() plus a query string -->

<section class="card p-4" aria-label="Filters">
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<h2 class="text-sm font-semibold">Period</h2>
		<p class="num text-xs text-ink-soft" data-testid="range-caption">
			{formatRange(state.from, state.to)}
		</p>
	</div>

	<nav aria-label="Period presets" class="-mx-1 mt-2 flex flex-wrap gap-1.5">
		{#each PRESETS as p (p.id)}
			<a
				href={presetHref(p.id)}
				aria-current={state.preset === p.id ? 'true' : undefined}
				class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 {state.preset ===
				p.id
					? 'border-primary-600 bg-primary-600 text-white'
					: 'border-line bg-card text-ink hover:bg-paper'}">{p.label}</a
			>
		{/each}
	</nav>

	<div class="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-[auto_1fr]">
		<form
			method="GET"
			action={base}
			class="flex flex-wrap items-end gap-3"
			aria-label="Custom range"
		>
			{#each Object.entries(keep) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			{#if state.granularityExplicit}<input type="hidden" name="g" value={state.granularity} />{/if}
			{#each state.categoryIds as id (id)}<input type="hidden" name="cat" value={id} />{/each}
			{#if state.includeTransfers}<input type="hidden" name="transfers" value="1" />{/if}
			<div>
				<label class="label" for="f-from">From</label>
				<input
					id="f-from"
					name="from"
					type="date"
					class="field"
					value={state.from ?? ''}
					required
				/>
			</div>
			<div>
				<label class="label" for="f-to">To</label>
				<input id="f-to" name="to" type="date" class="field" value={state.to ?? ''} required />
			</div>
			<button class="btn" type="submit">Apply dates</button>
		</form>

		<form
			method="GET"
			action={base}
			class="flex flex-wrap items-end gap-3 lg:justify-end"
			aria-label="Chart options"
		>
			{#each Object.entries(keep) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			{#if state.preset === 'custom'}
				{#if state.from}<input type="hidden" name="from" value={state.from} />{/if}
				{#if state.to}<input type="hidden" name="to" value={state.to} />{/if}
			{:else}
				<input type="hidden" name="range" value={state.preset} />
			{/if}
			<div>
				<label class="label" for="f-g">Group by</label>
				<select id="f-g" name="g" class="field">
					<option value="" selected={!state.granularityExplicit}>Auto ({state.granularity})</option>
					{#each GRANULARITIES as g (g.id)}
						<option value={g.id} selected={state.granularityExplicit && state.granularity === g.id}
							>{g.label}</option
						>
					{/each}
				</select>
			</div>
			{#if showCategories}
				<details class="relative">
					<summary
						class="field flex cursor-pointer list-none items-center gap-2 py-2.5 pr-3 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
					>
						<span>{catSummary}</span>
						<svg viewBox="0 0 12 12" class="size-3 text-ink-soft" aria-hidden="true">
							<path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" />
						</svg>
					</summary>
					<fieldset
						class="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-line bg-card p-2 shadow-card"
					>
						<legend class="sr-only">Categories</legend>
						{#each pickable as c (c.id)}
							<label
								class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 hover:bg-paper"
							>
								<input
									type="checkbox"
									name="cat"
									value={c.id}
									checked={selected.has(c.id)}
									class="rounded border-line text-primary-600 focus:ring-primary-500"
								/>
								<span
									class="size-2.5 shrink-0 rounded-full"
									style:background-color={c.color}
									aria-hidden="true"
								></span>
								<span class="text-sm">{c.name}</span>
							</label>
						{/each}
					</fieldset>
				</details>
			{/if}
			<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
				<input
					type="checkbox"
					name="transfers"
					value="1"
					checked={state.includeTransfers}
					class="rounded border-line text-primary-600 focus:ring-primary-500"
				/>
				Include transfers
			</label>
			<button class="btn btn-primary" type="submit">Apply</button>
			{#if filtersActive}
				<a class="btn" href={resetHref}>Clear filters</a>
			{/if}
		</form>
	</div>
</section>
