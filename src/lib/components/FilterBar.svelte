<script lang="ts">
	import {
		GRANULARITIES,
		PRESETS,
		SOURCES,
		buildSearch,
		type FilterState,
		type PresetId
	} from '#lib/dashboard/filters.ts';
	import { SvelteSet } from 'svelte/reactivity';
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
		state: filters,
		path,
		categories,
		keep = {},
		showCategories = true,
		showSource = false
	}: Props = $props();

	const base = $derived(path);
	const presetHref = (id: Exclude<PresetId, 'custom'>) =>
		`${base}${buildSearch({ ...filters, preset: id }, keep)}`;
	// Local copies so the picker can react to clicks before Apply; they reset when the URL state changes.
	let picked = $derived(new SvelteSet(filters.categoryIds));
	let pickedUncategorised = $derived(filters.includeUncategorised);
	let pickerOpen = $state(false);
	const allCategories = $derived(picked.size === 0 && !pickedUncategorised);
	const selectAll = () => {
		picked = new SvelteSet();
		pickedUncategorised = false;
	};
	const toggleCategory = (id: number, on: boolean) => {
		if (on) picked.add(id);
		else picked.delete(id);
	};
	const selected = $derived(new Set(filters.categoryIds));
	const pickable = $derived(categories.filter((c) => c.kind === 'expense' || c.kind === 'income'));
	const catCount = $derived(selected.size + (filters.includeUncategorised ? 1 : 0));
	const catSummary = $derived(
		catCount === 0
			? 'All categories'
			: catCount === 1
				? filters.includeUncategorised
					? 'Uncategorised'
					: (categories.find((c) => selected.has(c.id))?.name ?? '1 category')
				: `${catCount} categories`
	);
	const filtersActive = $derived(
		catCount > 0 || filters.includeTransfers || (showSource && filters.source !== 'any')
	);
	// What the Filters button counts: category selection, transfers, source and an explicit grouping.
	const activeCount = $derived(
		(catCount > 0 ? 1 : 0) +
			(filters.includeTransfers ? 1 : 0) +
			(showSource && filters.source !== 'any' ? 1 : 0) +
			(filters.granularityExplicit ? 1 : 0)
	);
	let panelOpen = $state(false);
	// On phones the preset strip scrolls sideways: keep the current period in view.
	let presetNav = $state<HTMLElement>();
	$effect(() => {
		void filters.preset;
		const el = presetNav?.querySelector<HTMLElement>('[aria-current]');
		if (presetNav && el) {
			presetNav.scrollLeft = el.offsetLeft - (presetNav.clientWidth - el.offsetWidth) / 2;
		}
	});
	const closePanel = () => {
		panelOpen = false;
		pickerOpen = false;
	};
	const resetHref = $derived(
		`${base}${buildSearch(
			{
				...filters,
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

<!-- One slim toolbar: period presets + range summary + a Filters popover. The popover is a native
     <details>, so it opens and the forms GET-submit without JavaScript. -->
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && panelOpen) closePanel();
	}}
/>

<section class="card relative p-2 sm:px-3" aria-label="Filters">
	<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<nav
			bind:this={presetNav}
			aria-label="Period presets"
			class="-my-1.5 min-w-0 basis-full [scrollbar-width:none] overflow-x-auto py-1.5 lg:flex-1 lg:basis-0 [&::-webkit-scrollbar]:hidden"
		>
			<div class="inline-flex rounded-full bg-paper p-1 whitespace-nowrap">
				{#each PRESETS as p (p.id)}
					<a
						href={presetHref(p.id)}
						onclick={closePanel}
						aria-current={filters.preset === p.id ? 'true' : undefined}
						class="relative inline-flex h-8 items-center rounded-full px-2 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 {filters.preset ===
						p.id
							? 'bg-primary-600 text-on-primary'
							: 'text-ink hover:bg-line'}">{p.label}</a
					>
				{/each}
			</div>
		</nav>

		<p class="num ml-1 text-sm text-ink-soft" data-testid="range-caption">
			{formatRange(filters.from, filters.to)}
		</p>

		<div class="ml-auto flex items-center gap-1">
			{#if filtersActive}
				<a
					class="relative rounded-lg px-2 py-1.5 text-sm font-medium text-ink-soft underline underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
					href={resetHref}>Clear filters</a
				>
			{/if}
			<details bind:open={panelOpen}>
				<summary
					class="relative flex h-8 cursor-pointer list-none items-center gap-2 rounded-full bg-paper px-3.5 text-sm font-medium text-ink transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 [&::-webkit-details-marker]:hidden"
				>
					<svg
						viewBox="0 0 16 16"
						class="size-4"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					>
						<path d="M2 4.5h12M4.5 8h7M7 11.5h2" />
					</svg>
					Filters
					{#if activeCount > 0}
						<span
							class="num inline-flex min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs leading-5 font-semibold text-on-primary"
							>{activeCount}<span class="sr-only"> active</span></span
						>
					{/if}
				</summary>

				<div
					class="absolute inset-x-2 top-full z-30 mt-2 flex flex-col gap-5 rounded-card bg-card p-4 shadow-pop sm:p-5"
				>
					<form
						method="GET"
						action={base}
						class="flex flex-wrap items-end gap-3"
						aria-label="Custom range"
						onsubmit={closePanel}
					>
						{#each Object.entries(keep) as [k, v] (k)}<input
								type="hidden"
								name={k}
								value={v}
							/>{/each}
						{#if filters.granularityExplicit}<input
								type="hidden"
								name="g"
								value={filters.granularity}
							/>{/if}
						{#each filters.categoryIds as id (id)}<input
								type="hidden"
								name="cat"
								value={id}
							/>{/each}
						{#if filters.includeUncategorised}<input
								type="hidden"
								name="uncategorised"
								value="1"
							/>{/if}
						{#if showSource && filters.source !== 'any'}<input
								type="hidden"
								name="source"
								value={filters.source}
							/>{/if}
						{#if filters.includeTransfers}<input type="hidden" name="transfers" value="1" />{/if}
						<div>
							<label class="label" for="f-from">From</label>
							<DateInput class="w-40" id="f-from" name="from" value={filters.from ?? ''} required />
						</div>
						<div>
							<label class="label" for="f-to">To</label>
							<DateInput class="w-40" id="f-to" name="to" value={filters.to ?? ''} required />
						</div>
						<button class="btn" type="submit">Apply dates</button>
					</form>

					<form
						method="GET"
						action={base}
						class="flex flex-wrap items-end gap-3"
						aria-label="Chart options"
						onsubmit={closePanel}
					>
						{#each Object.entries(keep) as [k, v] (k)}<input
								type="hidden"
								name={k}
								value={v}
							/>{/each}
						{#if filters.preset === 'custom'}
							{#if filters.from}<input type="hidden" name="from" value={filters.from} />{/if}
							{#if filters.to}<input type="hidden" name="to" value={filters.to} />{/if}
						{:else}
							<input type="hidden" name="range" value={filters.preset} />
						{/if}
						<div>
							<label class="label" for="f-g">Group by</label>
							<select id="f-g" name="g" class="field">
								<option value="" selected={!filters.granularityExplicit}
									>Auto ({filters.granularity})</option
								>
								{#each GRANULARITIES as g (g.id)}
									<option
										value={g.id}
										selected={filters.granularityExplicit && filters.granularity === g.id}
										>{g.label}</option
									>
								{/each}
							</select>
						</div>
						{#if showCategories}
							<details class="relative" bind:open={pickerOpen} data-testid="category-picker">
								<summary
									class="field flex cursor-pointer list-none items-center gap-2 border py-2.5 pr-3 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
								>
									<span>{catSummary}</span>
									<svg viewBox="0 0 12 12" class="size-3 text-ink-soft" aria-hidden="true">
										<path
											d="M2.5 4.5 6 8l3.5-3.5"
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
										/>
									</svg>
								</summary>
								<fieldset
									class="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-line bg-card p-2 shadow-pop"
								>
									<legend class="sr-only">Categories</legend>
									<label
										class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 hover:bg-paper"
									>
										<input
											type="checkbox"
											checked={allCategories}
											onchange={(e) => {
												selectAll();
												e.currentTarget.checked = true;
											}}
											class="rounded border-line text-primary-600 focus:ring-primary-500"
										/>
										<span class="text-sm font-medium">All categories</span>
									</label>
									<label
										class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 hover:bg-paper"
									>
										<input
											type="checkbox"
											name="uncategorised"
											value="1"
											bind:checked={pickedUncategorised}
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
												checked={picked.has(c.id)}
												onchange={(e) => toggleCategory(c.id, e.currentTarget.checked)}
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
										<option
											value={src.id === 'any' ? '' : src.id}
											selected={filters.source === src.id}>{src.label}</option
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
								checked={filters.includeTransfers}
								class="rounded border-line text-primary-600 focus:ring-primary-500"
							/>
							Include transfers
						</label>
						<button class="btn btn-primary" type="submit">Apply</button>
					</form>
				</div>
			</details>
		</div>
	</div>
</section>
