<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import CategoryIcon from '#lib/components/CategoryIcon.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import { formatDate } from '#lib/format/date.ts';
	import { formatMoney } from '#lib/format/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Which rows have "also create a rule" ticked (default off).
	let withRule = $state<Record<number, boolean>>({});

	const href = (page: number) => {
		const q = new SvelteURLSearchParams();
		if (data.search) q.set('q', data.search);
		if (page > 1) q.set('page', String(page));
		const qs = q.toString();
		return resolve('/admin/review') + (qs ? `?${qs}` : '');
	};
	/** Action URL that keeps the current search and page. */
	const act = (name: string) =>
		`?/${name}` +
		(data.search ? `&q=${encodeURIComponent(data.search)}` : '') +
		(data.queue.page > 1 ? `&page=${data.queue.page}` : '');
	const rowError = (id: number) =>
		form && 'errors' in form && form.errors && 'statementId' in form && form.statementId === id
			? Object.values(form.errors).join(' ')
			: null;
</script>

<svelte:head>
	<title>Review · Hearth admin</title>
</svelte:head>

<h1 class="text-3xl font-semibold">Review uncategorised</h1>
<p class="mt-2 max-w-2xl text-ink-soft">
	Give each movement a category. Tick “also create a rule” to teach Hearth the merchant, so future
	imports categorise it automatically.
</p>

<div aria-live="polite" class="mt-4 space-y-2">
	{#if form && 'saved' in form && form.saved}
		<p class="notice notice-ok" role="status">
			Category saved.
			{#if form.saved.rule}
				{form.saved.rule.created ? 'Rule created' : 'Existing rule reused'} for “{form.saved.rule
					.pattern}”; {form.saved.alsoCategorised} more
				{form.saved.alsoCategorised === 1 ? 'row was' : 'rows were'} categorised.
			{/if}
		</p>
	{/if}
	{#if form && 'applied' in form && form.applied}
		<p class="notice notice-ok" role="status">
			Rule for “{form.suggestion}” {form.applied.rule.created ? 'created' : 'already existed'};
			{form.applied.categorised}
			{form.applied.categorised === 1 ? 'row' : 'rows'} categorised.
		</p>
	{/if}
	{#if form && 'suggestion' in form && 'errors' in form && form.errors}
		<p class="notice notice-warn" role="alert">{Object.values(form.errors).join(' ')}</p>
	{/if}
</div>

{#if data.suggestions.length}
	<section class="mt-8" aria-labelledby="suggested">
		<h2 id="suggested" class="text-xl font-semibold">Suggested rules</h2>
		<p class="mt-1 text-sm text-ink-soft">
			Merchants that show up repeatedly in the queue. One click categorises all of them.
		</p>
		<ul class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each data.suggestions as s (s.merchant)}
				<li class="card p-4">
					<form method="POST" action={act('suggest')} use:enhance class="space-y-3">
						<input type="hidden" name="merchant" value={s.merchant} />
						<div class="flex items-baseline justify-between gap-3">
							<p class="font-medium break-all">{s.merchant}</p>
							<p class="num shrink-0 text-sm text-ink-soft">
								{s.count} × · {formatMoney(s.totalCents)}
							</p>
						</div>
						<div class="flex gap-2">
							<label class="sr-only" for="sugg-{s.merchant}">Category for {s.merchant}</label>
							<select id="sugg-{s.merchant}" name="categoryId" class="field" required>
								<option value="">Category…</option>
								{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
							</select>
							<button class="btn btn-primary shrink-0">Assign</button>
						</div>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="mt-10" aria-labelledby="queue">
	<h2 id="queue" class="text-xl font-semibold">Queue</h2>
	<form method="GET" class="mt-3 flex gap-2" role="search">
		<label class="sr-only" for="q">Search concepts</label>
		<input
			id="q"
			name="q"
			type="search"
			class="field max-w-sm"
			placeholder="Search concept…"
			value={data.search}
		/>
		<button class="btn">Search</button>
		{#if data.search}<a class="btn" href={resolve('/admin/review')}>Clear</a>{/if}
	</form>

	{#if data.queue.total === 0}
		<p class="card mt-4 p-6 text-sm text-ink-soft">
			{data.search ? 'No uncategorised movements match this search.' : 'Everything is categorised.'}
		</p>
	{:else}
		<ul class="mt-4 space-y-3">
			{#each data.queue.rows as row (row.id)}
				<li class="card p-4" data-testid="review-row">
					<form method="POST" action={act('assign')} use:enhance class="space-y-3">
						<input type="hidden" name="statementId" value={row.id} />
						<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<p class="flex items-start gap-2 font-medium break-all">
								<CategoryIcon color={null} size="sm" badge />
								<span>{row.concept}</span>
							</p>
							<p class="num shrink-0 font-semibold {row.amountCents < 0 ? '' : 'text-primary-700'}">
								{row.amountCents < 0 ? 'Out' : 'In'}
								{formatMoney(Math.abs(row.amountCents))}
							</p>
						</div>
						<p class="text-xs text-ink-soft">{formatDate(row.bookingDate)}</p>
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
							<div class="sm:w-60">
								<label class="sr-only" for="cat-{row.id}">Category for {row.concept}</label>
								<select id="cat-{row.id}" name="categoryId" class="field" required>
									<option value="">Category…</option>
									{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
								</select>
							</div>
							<label class="flex min-h-11 items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="createRule"
									class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
									bind:checked={withRule[row.id]}
								/>
								Also create a rule
							</label>
							<button class="btn btn-primary sm:ml-auto">Save</button>
						</div>
						{#if withRule[row.id]}
							<div>
								<label class="label" for="pattern-{row.id}">Rule pattern (contains)</label>
								<input
									id="pattern-{row.id}"
									name="pattern"
									class="field"
									value={row.suggestedPattern}
									maxlength="255"
									required
								/>
								<p class="hint">Matches any movement whose concept contains this text.</p>
							</div>
						{/if}
						{#if rowError(row.id)}<p class="field-error" role="alert">{rowError(row.id)}</p>{/if}
					</form>
				</li>
			{/each}
		</ul>
		<div class="mt-4">
			<Pager
				page={data.queue.page}
				pageSize={data.queue.pageSize}
				total={data.queue.total}
				{href}
			/>
		</div>
	{/if}
</section>
