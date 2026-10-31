<script lang="ts">
	import {
		GRANULARITIES,
		PRESETS,
		SOURCES,
		buildSearch,
		type FilterState,
		type PresetId
	} from '#lib/dashboard/filters.ts';
	import CategoryIcon from './CategoryIcon.svelte';
	import DateInput from './DateInput.svelte';
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
		/** Show the "Source" select (transactions explorer only). */
		showSource?: boolean;
	}
	let {
		state,
		path,
		categories,
		keep = {},
		showCategories = true,
		showSource = false
	}: Props = $props();

	const base = $derived(path);
	const presetHref = (id: Exclude<PresetId, 'custom'>) =>
		`${base}${buildSearch({ ...state, preset: id }, keep)}`;
	const selected = $derived(new Set(state.categoryIds));
	const pickable = $derived(categories.filter((c) => c.kind === 'expense' || c.kind === 'income'));
	const catCount = $derived(selected.size + (state.includeUncategorised ? 1 : 0));
	const catSummary = $derived(
		catCount === 0
			? 'All categories'
			: catCount === 1
				? state.includeUncategorised
					? 'Uncategorised'
					: (categories.find((c) => selected.has(c.id))?.name ?? '1 category')
				: `${catCount} categories`
	);
	const filtersActive = $derived(
		catCount > 0 || state.includeTransfers || (showSource && state.source !== 'any')
	);
	const resetHref = $derived(
		`${base}${buildSearch(
			{
				...state,
				categoryIds: [],
				includeUncategorised: false,
				includeTransfers: false,
				source: 'any'
			},
			keep
		)}`
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
					? 'border-primary-600 bg-primary-600 text-on-primary'
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
			{#if state.includeUncategorised}<input type="hidden" name="uncategorised" value="1" />{/if}
			{#if showSource && state.source !== 'any'}<input
					type="hidden"
					name="source"
					value={state.source}
				/>{/if}
			{#if state.includeTransfers}<input type="hidden" name="transfers" value="1" />{/if}
			<div>
				<label class="label" for="f-from">From</label>
				<DateInput class="w-44" id="f-from" name="from" value={state.from ?? ''} required />
			</div>
			<div>
				<label class="label" for="f-to">To</label>
				<DateInput class="w-44" id="f-to" name="to" value={state.to ?? ''} required />
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
						<label
							class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 hover:bg-paper"
						>
							<input
								type="checkbox"
								name="uncategorised"
								value="1"
								checked={state.includeUncategorised}
								class="rounded border-line text-primary-600 focus:ring-primary-500"
							/>
							<CategoryIcon color={null} size="sm" />
							<span class="text-sm">Uncategorised</span>
						</label>
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
									class="cat-dot size-2.5 shrink-0 rounded-full"
									style:--cat={c.color}
									aria-hidden="true"
								></span>
								<span class="text-sm">{c.name}</span>
							</label>
						{/each}
					</fieldset>
				</details>
			{/if}
			{#if showSource}
				<div>
					<label class="label" for="f-source">Source</label>
					<select id="f-source" name="source" class="field">
						{#each SOURCES as src (src.id)}
							<option value={src.id === 'any' ? '' : src.id} selected={state.source === src.id}
								>{src.label}</option
							>
						{/each}
					</select>
				</div>
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
