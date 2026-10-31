<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import CategoryIcon from '#lib/components/CategoryIcon.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import { formatDay } from '#lib/dashboard/insights.ts';
	import { formatMoney } from '#lib/format/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const FREQUENCIES = [
		{ value: 'weekly', label: 'Every week' },
		{ value: 'biweekly', label: 'Every two weeks' },
		{ value: 'monthly', label: 'Every month' }
	];
	const ordinal = (n: number) => {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
	};
	const describe = (r: { frequency: string; anchor: number }) =>
		r.frequency === 'monthly'
			? `On the ${ordinal(r.anchor)} of every month`
			: `${r.frequency === 'weekly' ? 'Every' : 'Every other'} ${WEEKDAYS[r.anchor - 1]}`;

	const errorsFor = (action: string, id: number | null) =>
		form && 'errors' in form && form.action === action && ('id' in form ? form.id === id : true)
			? (form.errors as Record<string, string>)
			: {};
	const valuesFor = (action: string, id: number | null): Record<string, string> =>
		form && 'values' in form && form.action === action && form.id === id
			? ((form.values as Record<string, string>) ?? {})
			: {};

	/** Action URL that keeps the current filter, search and page. */
	const act = (name: string) =>
		`${page.url.pathname}${page.url.search ? `${page.url.search}&` : '?'}/${name}`;
	const centsText = (cents: number) => (Math.abs(cents) / 100).toFixed(2);

	// Per-form UI state (frequency switches the anchor choices; category drives the icon preview).
	let freq = $state<Record<string, string>>({});
	let picked = $state<Record<string, string>>({});
	const catOf = (prefix: string, initial: string | undefined) =>
		data.categories.find((c) => String(c.id) === (picked[prefix] ?? initial ?? ''));

	const href = (p: number, kind = data.kind, q = data.q) => {
		const sp = new SvelteURLSearchParams();
		if (q) sp.set('q', q);
		if (kind !== 'all') sp.set('kind', kind);
		if (p > 1) sp.set('page', String(p));
		const qs = sp.toString();
		return resolve('/admin/manual') + (qs ? `?${qs}` : '');
	};
	const recurringStatus = (r: (typeof data.recurring)[number]) =>
		r.endDate && r.endDate < data.today ? 'Ended' : r.isActive ? 'Active' : 'Paused';
</script>

{#snippet categorySelect(prefix: string, v: Record<string, string>, errors: Record<string, string>)}
	<div>
		<label class="label" for="{prefix}-cat">Category</label>
		<div class="flex items-center gap-2">
			<CategoryIcon
				icon={catOf(prefix, v.categoryId)?.icon ?? null}
				slug={catOf(prefix, v.categoryId)?.slug ?? null}
				color={catOf(prefix, v.categoryId)?.color ?? null}
				size="md"
				badge
			/>
			<select
				id="{prefix}-cat"
				name="categoryId"
				class="field"
				onchange={(e) => (picked[prefix] = e.currentTarget.value)}
			>
				<option value="">No category</option>
				{#each data.categories as c (c.id)}
					<option value={c.id} selected={String(c.id) === (picked[prefix] ?? v.categoryId)}
						>{c.name}</option
					>
				{/each}
			</select>
		</div>
		{#if errors.categoryId}<p class="field-error">{errors.categoryId}</p>{/if}
	</div>
{/snippet}

{#snippet direction(v: Record<string, string>)}
	<fieldset>
		<legend class="label">Type</legend>
		<div class="flex gap-4">
			{#each [{ value: 'out', label: 'Expense' }, { value: 'in', label: 'Income' }] as o (o.value)}
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input
						type="radio"
						name="direction"
						value={o.value}
						checked={(v.direction ?? 'out') === o.value}
						class="size-5 border-line text-primary-600 focus:ring-primary-500"
					/>
					{o.label}
				</label>
			{/each}
		</div>
	</fieldset>
{/snippet}

{#snippet entryFields(prefix: string, v: Record<string, string>, errors: Record<string, string>)}
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="{prefix}-date">Date</label>
			<input
				id="{prefix}-date"
				name="bookingDate"
				type="date"
				class="field"
				value={v.bookingDate ?? data.today}
				required
				aria-invalid={errors.bookingDate ? 'true' : undefined}
			/>
			{#if errors.bookingDate}<p class="field-error">{errors.bookingDate}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-amount">Amount (EUR)</label>
			<input
				id="{prefix}-amount"
				name="amount"
				class="field num"
				inputmode="decimal"
				autocomplete="off"
				placeholder="40.00"
				value={v.amount ?? ''}
				required
				aria-invalid={errors.amount ? 'true' : undefined}
			/>
			{#if errors.amount}<p class="field-error">{errors.amount}</p>{/if}
		</div>
		{@render direction(v)}
		<div>
			<label class="label" for="{prefix}-concept">Concept</label>
			<input
				id="{prefix}-concept"
				name="concept"
				class="field"
				maxlength="255"
				placeholder="Cleaner"
				value={v.concept ?? ''}
				required
				aria-invalid={errors.concept ? 'true' : undefined}
			/>
			{#if errors.concept}<p class="field-error">{errors.concept}</p>{/if}
		</div>
		{@render categorySelect(prefix, v, errors)}
		<div>
			<label class="label" for="{prefix}-note">Note (optional)</label>
			<input id="{prefix}-note" name="note" class="field" maxlength="500" value={v.note ?? ''} />
			{#if errors.note}<p class="field-error">{errors.note}</p>{/if}
		</div>
	</div>
	{@render balanceBox(v)}
{/snippet}

{#snippet balanceBox(v: Record<string, string>)}
	<label class="flex min-h-11 items-start gap-2 text-sm">
		<input
			type="checkbox"
			name="affectsBalance"
			class="mt-0.5 size-5 shrink-0 rounded border-line text-primary-600 focus:ring-primary-500"
			checked={v.affectsBalance === 'on'}
		/>
		<span>
			Paid from the joint account (adjusts the balance)
			<span class="hint block">
				Leave unticked for cash or anything the bank balance does not show. Ticked entries change
				the displayed balance for dates after the latest bank movement.
			</span>
		</span>
	</label>
{/snippet}

{#snippet recurringFields(
	prefix: string,
	v: Record<string, string>,
	errors: Record<string, string>
)}
	{@const f = freq[prefix] ?? v.frequency ?? 'weekly'}
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="{prefix}-freq">Repeats</label>
			<select
				id="{prefix}-freq"
				name="frequency"
				class="field"
				onchange={(e) => (freq[prefix] = e.currentTarget.value)}
			>
				{#each FREQUENCIES as o (o.value)}
					<option value={o.value} selected={o.value === f}>{o.label}</option>
				{/each}
			</select>
			{#if errors.frequency}<p class="field-error">{errors.frequency}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-anchor"
				>{f === 'monthly' ? 'Day of month' : 'Weekday'}</label
			>
			<select id="{prefix}-anchor" name="anchor" class="field">
				{#if f === 'monthly'}
					{#each Array.from({ length: 31 }, (_, i) => i + 1) as d (d)}
						<option value={d} selected={String(d) === (v.anchor ?? '1')}>{d}</option>
					{/each}
				{:else}
					{#each WEEKDAYS as name, i (name)}
						<option value={i + 1} selected={String(i + 1) === (v.anchor ?? '5')}>{name}</option>
					{/each}
				{/if}
			</select>
			{#if f === 'monthly'}<p class="hint">
					Short months use their last day (31 becomes 28, 29 or 30).
				</p>{/if}
			{#if errors.anchor}<p class="field-error">{errors.anchor}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-amount">Amount (EUR)</label>
			<input
				id="{prefix}-amount"
				name="amount"
				class="field num"
				inputmode="decimal"
				autocomplete="off"
				placeholder="40.00"
				value={v.amount ?? ''}
				required
				aria-invalid={errors.amount ? 'true' : undefined}
			/>
			{#if errors.amount}<p class="field-error">{errors.amount}</p>{/if}
		</div>
		{@render direction(v)}
		<div>
			<label class="label" for="{prefix}-concept">Concept</label>
			<input
				id="{prefix}-concept"
				name="concept"
				class="field"
				maxlength="255"
				placeholder="Cleaner"
				value={v.concept ?? ''}
				required
				aria-invalid={errors.concept ? 'true' : undefined}
			/>
			{#if errors.concept}<p class="field-error">{errors.concept}</p>{/if}
		</div>
		{@render categorySelect(prefix, v, errors)}
		<div>
			<label class="label" for="{prefix}-start">Starts</label>
			<input
				id="{prefix}-start"
				name="startDate"
				type="date"
				class="field"
				value={v.startDate ?? data.today}
				required
			/>
			{#if errors.startDate}<p class="field-error">{errors.startDate}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-end">Ends (optional)</label>
			<input id="{prefix}-end" name="endDate" type="date" class="field" value={v.endDate ?? ''} />
			{#if errors.endDate}<p class="field-error">{errors.endDate}</p>{/if}
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="{prefix}-note">Note (optional)</label>
			<input id="{prefix}-note" name="note" class="field" maxlength="500" value={v.note ?? ''} />
		</div>
	</div>
	{@render balanceBox(v)}
{/snippet}

<svelte:head>
	<title>Manual payments · Hearth admin</title>
</svelte:head>

<h1 class="text-3xl font-semibold">Manual payments</h1>
<p class="mt-2 max-w-2xl text-ink-soft">
	Add payments that are not in the bank file, such as a cleaner paid in cash, once or on a schedule.
	They appear in every chart and list like any other movement, marked “manual”. Imported movements
	can never be edited here.
</p>

<div aria-live="polite" class="mt-4 space-y-2">
	{#if form && 'saved' in form && form.saved}
		<p class="notice notice-ok" role="status">{form.saved}.</p>
	{/if}
	{#if form && 'errors' in form && form.errors && '_form' in form.errors}
		<p class="notice notice-warn" role="alert">{form.errors._form}</p>
	{/if}
</div>

<p class="notice notice-warn mt-2" data-testid="double-count-notice">
	Cash withdrawals in the bank file are already counted under “Cash withdrawals”. Entering the same
	cash as spending here counts it twice: either put the withdrawal in “Internal transfer” or leave
	it as it is.
</p>

<div class="mt-8 grid gap-6 lg:grid-cols-2">
	<section aria-labelledby="add-one">
		<h2 id="add-one" class="text-xl font-semibold">Add a payment</h2>
		<form method="POST" action={act('addEntry')} use:enhance class="card mt-3 space-y-4 p-5">
			{@render entryFields('one', valuesFor('addEntry', null), errorsFor('addEntry', null))}
			<button class="btn btn-primary">Add payment</button>
		</form>
	</section>
	<section aria-labelledby="add-rec">
		<h2 id="add-rec" class="text-xl font-semibold">Repeat a payment</h2>
		<form method="POST" action={act('addRecurring')} use:enhance class="card mt-3 space-y-4 p-5">
			{@render recurringFields(
				'rec',
				valuesFor('addRecurring', null),
				errorsFor('addRecurring', null)
			)}
			<button class="btn btn-primary">Add recurring payment</button>
		</form>
	</section>
</div>

<section class="mt-10" aria-labelledby="rec-list">
	<h2 id="rec-list" class="text-xl font-semibold">Recurring payments ({data.recurring.length})</h2>
	<p class="mt-1 text-sm text-ink-soft">
		Entries are created automatically up to today. Editing changes future entries only; entries
		already created keep their values.
	</p>
	{#if data.recurring.length === 0}
		<p class="card mt-3 p-6 text-sm text-ink-soft">Nothing repeats yet.</p>
	{:else}
		<ul class="mt-3 space-y-3" data-testid="recurring-list">
			{#each data.recurring as r (r.id)}
				{@const status = recurringStatus(r)}
				<li class="card p-4" data-testid="recurring-row">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<CategoryIcon
							icon={r.categoryIcon}
							slug={r.categorySlug}
							color={r.categoryColor}
							size="md"
							badge
						/>
						<div class="min-w-0">
							<p class="font-medium">{r.concept}</p>
							<p class="text-sm text-ink-soft">
								{describe(r)} · from {formatDay(r.startDate)}{r.endDate
									? ` to ${formatDay(r.endDate)}`
									: ''}
							</p>
						</div>
						<p class="num ml-auto font-semibold {r.direction === 'in' ? 'text-primary-700' : ''}">
							{r.direction === 'in' ? '+' : '-'}{formatMoney(r.amountCents)}
						</p>
						<span class="pill {status === 'Active' ? 'pill-ok' : ''}">{status}</span>
					</div>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						{#if r.isActive && status !== 'Ended'}
							<form method="POST" action={act('pauseRecurring')} use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="btn" aria-label="Pause {r.concept}">Pause</button>
							</form>
							<form method="POST" action={act('endRecurring')} use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="btn" aria-label="End {r.concept} today">End today</button>
							</form>
						{:else if !r.isActive}
							<form method="POST" action={act('resumeRecurring')} use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="btn" aria-label="Resume {r.concept}">Resume</button>
							</form>
						{/if}
						<span class="num text-sm text-ink-soft">{r.generatedCount} entries created</span>
					</div>
					<details class="mt-2">
						<summary
							class="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-700"
							>Edit {r.concept}</summary
						>
						<form method="POST" action={act('updateRecurring')} use:enhance class="mt-3 space-y-4">
							<input type="hidden" name="id" value={r.id} />
							{@render recurringFields(
								`rec-${r.id}`,
								{
									frequency: r.frequency,
									anchor: String(r.anchor),
									amount: centsText(r.amountCents),
									direction: r.direction,
									concept: r.concept,
									categoryId: r.categoryId === null ? '' : String(r.categoryId),
									startDate: r.startDate,
									endDate: r.endDate ?? '',
									note: r.note ?? '',
									affectsBalance: r.affectsBalance ? 'on' : '',
									...valuesFor('updateRecurring', r.id)
								},
								errorsFor('updateRecurring', r.id)
							)}
							<button class="btn btn-primary">Save changes</button>
						</form>
					</details>
					<details class="mt-1">
						<summary class="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium"
							>Delete {r.concept}</summary
						>
						<form method="POST" action={act('deleteRecurring')} use:enhance class="mt-2 space-y-3">
							<input type="hidden" name="id" value={r.id} />
							<p class="text-sm text-ink-soft">
								Entries already created stay in your history{data.future[r.id]
									? '' + ` unless you tick the box below.`
									: '.'}
							</p>
							{#if data.future[r.id]}
								<label class="flex min-h-11 items-center gap-2 text-sm">
									<input
										type="checkbox"
										name="deleteFuture"
										class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
									/>
									Also delete the {data.future[r.id]} generated entries dated after today
								</label>
							{/if}
							<button class="btn btn-danger" aria-label="Delete recurring payment {r.concept}"
								>Delete recurring payment</button
							>
						</form>
					</details>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="mt-10" aria-labelledby="entries">
	<h2 id="entries" class="text-xl font-semibold">Manual entries ({data.entries.total})</h2>
	<form method="GET" class="mt-3 flex flex-wrap items-end gap-3" role="search">
		<div class="min-w-48 flex-1 sm:max-w-xs">
			<label class="label" for="q">Search concept</label>
			<input id="q" name="q" type="search" class="field" value={data.q} autocomplete="off" />
		</div>
		<div>
			<label class="label" for="kind">Show</label>
			<select id="kind" name="kind" class="field">
				<option value="all" selected={data.kind === 'all'}>All</option>
				<option value="oneoff" selected={data.kind === 'oneoff'}>One-off</option>
				<option value="recurring" selected={data.kind === 'recurring'}>From recurring</option>
			</select>
		</div>
		<button class="btn">Filter</button>
		{#if data.q || data.kind !== 'all'}<a class="btn" href={resolve('/admin/manual')}>Clear</a>{/if}
	</form>

	{#if data.entries.total === 0}
		<p class="card mt-4 p-6 text-sm text-ink-soft">No manual entries match.</p>
	{:else}
		<ul class="mt-4 space-y-3" data-testid="manual-entries">
			{#each data.entries.rows as e (e.id)}
				<li class="card p-4" data-testid="manual-row">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<CategoryIcon
							icon={e.categoryIcon}
							slug={e.categorySlug}
							color={e.categoryId === null ? null : e.categoryColor}
							size="md"
							badge
						/>
						<div class="min-w-0">
							<p class="font-medium break-words">{e.concept}</p>
							<p class="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
								<span>{formatDay(e.bookingDate)}</span>
								<span>{e.categoryName ?? 'Uncategorised'}</span>
								{#if e.recurringId}<span class="pill">recurring</span>{/if}
								{#if e.affectsBalance}<span class="pill">adjusts balance</span>{/if}
							</p>
							{#if e.note}<p class="text-sm text-ink-soft">{e.note}</p>{/if}
						</div>
						<p class="num ml-auto font-semibold {e.amountCents > 0 ? 'text-primary-700' : ''}">
							{e.amountCents > 0 ? '+' : '-'}{formatMoney(Math.abs(e.amountCents))}
						</p>
					</div>
					<details class="mt-2">
						<summary
							class="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-700"
							>Edit {e.concept}</summary
						>
						<form method="POST" action={act('updateEntry')} use:enhance class="mt-3 space-y-4">
							<input type="hidden" name="id" value={e.id} />
							{@render entryFields(
								`e-${e.id}`,
								{
									bookingDate: e.bookingDate,
									amount: centsText(e.amountCents),
									direction: e.amountCents > 0 ? 'in' : 'out',
									concept: e.concept,
									categoryId: e.categoryId === null ? '' : String(e.categoryId),
									note: e.note ?? '',
									affectsBalance: e.affectsBalance ? 'on' : '',
									...valuesFor('updateEntry', e.id)
								},
								errorsFor('updateEntry', e.id)
							)}
							<div class="flex flex-wrap gap-2">
								<button class="btn btn-primary">Save changes</button>
							</div>
						</form>
						<form method="POST" action={act('deleteEntry')} use:enhance class="mt-2">
							<input type="hidden" name="id" value={e.id} />
							<button class="btn btn-danger" aria-label="Delete {e.concept}">Delete entry</button>
						</form>
					</details>
				</li>
			{/each}
		</ul>
		<div class="mt-4">
			<Pager
				page={data.entries.page}
				pageSize={data.entries.pageSize}
				total={data.entries.total}
				href={(p) => href(p)}
			/>
		</div>
	{/if}
</section>
