<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '#lib/format/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorsFor = (action: string, id: number | null): Record<string, string> =>
		form && 'errors' in form && form.errors && form.action === action && form.id === id
			? (form.errors as Record<string, string>)
			: {};
	const valuesFor = (action: string, id: number | null): Record<string, string> =>
		form && 'values' in form && form.action === action && form.id === id ? (form.values ?? {}) : {};
</script>

{#snippet ruleFields(prefix: string, v: Record<string, string>, errors: Record<string, string>)}
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<label class="label" for="{prefix}-pattern">Pattern</label>
			<input
				id="{prefix}-pattern"
				name="pattern"
				class="field font-mono"
				value={v.pattern ?? ''}
				maxlength="255"
				required
				spellcheck="false"
				aria-invalid={errors.pattern ? 'true' : undefined}
			/>
			{#if errors.pattern}<p class="field-error">{errors.pattern}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-type">Match type</label>
			<select id="{prefix}-type" name="matchType" class="field">
				<option value="contains" selected={(v.matchType ?? 'contains') === 'contains'}>
					Contains (case-insensitive)
				</option>
				<option value="regex" selected={v.matchType === 'regex'}>Regular expression</option>
			</select>
		</div>
		<div>
			<label class="label" for="{prefix}-dir">Direction</label>
			<select id="{prefix}-dir" name="direction" class="field">
				<option value="any" selected={(v.direction ?? 'any') === 'any'}>Any</option>
				<option value="out" selected={v.direction === 'out'}>Money out only</option>
				<option value="in" selected={v.direction === 'in'}>Money in only</option>
			</select>
		</div>
		<div>
			<label class="label" for="{prefix}-cat">Category</label>
			<select id="{prefix}-cat" name="categoryId" class="field" required>
				<option value="">Choose…</option>
				{#each data.categories as c (c.id)}
					<option value={c.id} selected={String(c.id) === v.categoryId}>{c.name}</option>
				{/each}
			</select>
			{#if errors.categoryId}<p class="field-error">{errors.categoryId}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-person">Person (optional)</label>
			<select id="{prefix}-person" name="personId" class="field">
				<option value="">Nobody</option>
				{#each data.people as p (p.id)}
					<option value={p.id} selected={String(p.id) === v.personId}>{p.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="{prefix}-prio">Priority</label>
			<input
				id="{prefix}-prio"
				name="priority"
				type="number"
				inputmode="numeric"
				class="field num max-w-32"
				value={v.priority ?? '100'}
			/>
			<p class="hint">Lower numbers are checked first.</p>
			{#if errors.priority}<p class="field-error">{errors.priority}</p>{/if}
		</div>
		<label class="flex min-h-11 items-center gap-2 self-end text-sm">
			<input
				type="checkbox"
				name="isActive"
				class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
				checked={v.isActive === undefined ? true : v.isActive === 'on'}
			/>
			Active
		</label>
	</div>
{/snippet}

<svelte:head>
	<title>Rules · Hearth admin</title>
</svelte:head>

<h1 class="text-3xl font-semibold">Rules</h1>
<p class="mt-2 max-w-2xl text-ink-soft">
	The first matching active rule, lowest priority number first, decides a movement's category.
	Manual choices are never overwritten.
</p>

<div aria-live="polite" class="mt-4 space-y-2">
	{#if form && 'saved' in form && form.saved}
		<p class="notice notice-ok" role="status">
			{form.saved}.
			{#if 'reapplied' in form && form.reapplied}
				{form.reapplied.examined} rows examined, {form.reapplied.matched} matched,
				{form.reapplied.cleared} reset to uncategorised.
			{/if}
		</p>
	{/if}
	{#if form && 'errors' in form && form.errors && '_form' in form.errors}
		<p class="notice notice-warn" role="alert">{form.errors._form}</p>
	{/if}
</div>

<section class="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Tools">
	<div class="card p-5">
		<h2 class="text-lg font-semibold">Test a pattern</h2>
		<p class="mt-1 text-sm text-ink-soft">See what a pattern would match before saving it.</p>
		<form method="GET" class="mt-3 space-y-3" role="search">
			<div>
				<label class="label" for="test">Pattern</label>
				<input
					id="test"
					name="test"
					class="field font-mono"
					value={data.testInput.pattern}
					required
					spellcheck="false"
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label" for="test-type">Match type</label>
					<select id="test-type" name="type" class="field">
						<option value="contains" selected={data.testInput.matchType === 'contains'}
							>Contains</option
						>
						<option value="regex" selected={data.testInput.matchType === 'regex'}>Regex</option>
					</select>
				</div>
				<div>
					<label class="label" for="test-dir">Direction</label>
					<select id="test-dir" name="dir" class="field">
						<option value="any" selected={data.testInput.direction === 'any'}>Any</option>
						<option value="out" selected={data.testInput.direction === 'out'}>Out</option>
						<option value="in" selected={data.testInput.direction === 'in'}>In</option>
					</select>
				</div>
			</div>
			<button class="btn">Test pattern</button>
		</form>
		{#if data.preview}
			<div class="mt-4" aria-live="polite">
				{#if !data.preview.ok}
					<p class="field-error" role="alert">{Object.values(data.preview.errors).join(' ')}</p>
				{:else}
					<p class="text-sm font-medium">
						<span class="num">{data.preview.value.count}</span>
						{data.preview.value.count === 1 ? 'statement matches' : 'statements match'}
					</p>
					<ul class="mt-2 divide-y divide-line text-sm">
						{#each data.preview.value.sample as hit (hit.id)}
							<li class="flex justify-between gap-3 py-2">
								<span class="min-w-0 break-all">{hit.concept}</span>
								<span class="num shrink-0 text-ink-soft">
									{hit.amountCents < 0 ? 'Out' : 'In'}
									{formatMoney(Math.abs(hit.amountCents))}
								</span>
							</li>
						{/each}
					</ul>
					{#if data.preview.value.count > data.preview.value.sample.length}
						<p class="hint">Showing the newest {data.preview.value.sample.length}.</p>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<div class="card p-5">
		<h2 class="text-lg font-semibold">Re-apply rules</h2>
		<p class="mt-1 text-sm text-ink-soft">
			Runs every active rule over all movements that were not categorised by hand. Rows whose rule
			no longer matches go back to uncategorised.
		</p>
		<form method="POST" action="?/reapply" use:enhance class="mt-4">
			<button class="btn btn-primary">Re-apply rules to all non-manual rows</button>
		</form>
	</div>
</section>

<section class="mt-10" aria-labelledby="new">
	<h2 id="new" class="text-xl font-semibold">New rule</h2>
	<form method="POST" action="?/create" use:enhance class="card mt-3 space-y-4 p-5">
		{@render ruleFields('new', valuesFor('create', null), errorsFor('create', null))}
		<button class="btn btn-primary">Add rule</button>
	</form>
</section>

<section class="mt-10" aria-labelledby="list">
	<h2 id="list" class="text-xl font-semibold">All rules ({data.rules.length})</h2>
	<ol class="mt-3 space-y-3">
		{#each data.rules as rule, i (rule.id)}
			<li class="card p-4">
				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<p class="num w-10 text-sm text-ink-soft">{rule.priority}</p>
					<p class="min-w-0 font-mono text-sm font-medium break-all">{rule.pattern}</p>
					<span class="pill">{rule.matchType}</span>
					{#if rule.direction !== 'any'}<span class="pill">{rule.direction}</span>{/if}
					<span class="text-sm">→ {rule.categoryName}</span>
					{#if !rule.categoryActive}<span class="pill pill-warn">archived category</span>{/if}
					{#if rule.personName}<span class="pill pill-ok">{rule.personName}</span>{/if}
					{#if !rule.isActive}<span class="pill pill-warn">inactive</span>{/if}
					<div class="ml-auto flex gap-1">
						<form method="POST" action="?/move" use:enhance>
							<input type="hidden" name="id" value={rule.id} />
							<input type="hidden" name="dir" value="up" />
							<button class="btn px-3" disabled={i === 0} aria-label="Move {rule.pattern} up"
								>↑</button
							>
						</form>
						<form method="POST" action="?/move" use:enhance>
							<input type="hidden" name="id" value={rule.id} />
							<input type="hidden" name="dir" value="down" />
							<button
								class="btn px-3"
								disabled={i === data.rules.length - 1}
								aria-label="Move {rule.pattern} down">↓</button
							>
						</form>
					</div>
				</div>
				<details class="mt-2" open={form?.action === 'update' && form.id === rule.id}>
					<summary
						class="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-700"
					>
						Edit or delete
					</summary>
					<form method="POST" action="?/update" use:enhance class="mt-3 space-y-4">
						<input type="hidden" name="id" value={rule.id} />
						{@render ruleFields(
							`edit-${rule.id}`,
							valuesFor('update', rule.id).pattern !== undefined
								? valuesFor('update', rule.id)
								: {
										pattern: rule.pattern,
										matchType: rule.matchType,
										direction: rule.direction,
										categoryId: String(rule.categoryId),
										personId: rule.personId === null ? '' : String(rule.personId),
										priority: String(rule.priority),
										isActive: rule.isActive ? 'on' : 'off'
									},
							errorsFor('update', rule.id)
						)}
						<button class="btn btn-primary">Save rule</button>
					</form>
					<form method="POST" action="?/delete" use:enhance class="mt-3">
						<input type="hidden" name="id" value={rule.id} />
						<button class="btn btn-danger" aria-label="Delete rule {rule.pattern}"
							>Delete rule</button
						>
					</form>
				</details>
			</li>
		{/each}
	</ol>
</section>
