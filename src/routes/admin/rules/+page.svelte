<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { formatMoney } from '#lib/format/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorsFor = (action: string, id: number | null): Record<string, string> =>
		form && 'errors' in form && form.errors && form.action === action && form.id === id
			? (form.errors as Record<string, string>)
			: {};
	type PlanRow = {
		rule: {
			pattern: string;
			matchType: string;
			direction: string;
			categorySlug: string;
			person: string | null;
			isActive: boolean;
		};
		differences?: string[];
	};
	const preview = $derived(form && 'importPreview' in form ? form.importPreview : null);
	const importResult = $derived(form && 'importResult' in form ? form.importResult : null);
	const importError = $derived(form && 'importError' in form ? form.importError : null);
	const LIST_CAP = 100;
	/** After the preview/result renders, move focus to its heading so the change is announced and in view. */
	const focusHeading = (id: string) => () => async (opts: { update: () => Promise<void> }) => {
		await opts.update();
		await tick();
		document.getElementById(id)?.focus();
	};
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

<h1 class="page-title">Rules</h1>
<p class="page-lead">
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
		<h2 class="section-title">Test a pattern</h2>
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
		<h2 class="section-title">Re-apply rules</h2>
		<p class="mt-1 text-sm text-ink-soft">
			Runs every active rule over all movements that were not categorised by hand. Rows whose rule
			no longer matches go back to uncategorised.
		</p>
		<form method="POST" action="?/reapply" use:enhance class="mt-4">
			<button class="btn btn-primary">Re-apply rules to all non-manual rows</button>
		</form>
	</div>
	<div class="card p-5 lg:col-span-2" id="import-export">
		<h2 class="section-title">Import / export</h2>
		<p class="mt-1 max-w-3xl text-sm text-ink-soft">
			Back up your rules or share them with another install. The file holds rules and their
			categories only, never any transactions, amounts or account data.
		</p>
		<div class="mt-4 grid gap-6 md:grid-cols-2">
			<form
				method="GET"
				action={resolve('/admin/rules/export')}
				data-sveltekit-reload
				class="space-y-3"
			>
				<h3 class="text-sm font-semibold">Export</h3>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="active"
						value="1"
						class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
					/>
					Only active rules
				</label>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="categories"
						value="all"
						class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
					/>
					Include every category, not just those the rules use
				</label>
				<button class="btn">Download rules (JSON)</button>
			</form>
			<form
				method="POST"
				action="?/previewImport"
				enctype="multipart/form-data"
				use:enhance={focusHeading('import-preview')}
				class="space-y-3"
			>
				<h3 class="text-sm font-semibold">Import</h3>
				<div>
					<label class="label" for="import-file">Rules file (JSON, up to 2 MB)</label>
					<input
						id="import-file"
						name="file"
						type="file"
						accept="application/json,.json"
						required
						class="field file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
					/>
					<p class="hint">You see a preview first; nothing is written until you confirm.</p>
				</div>
				<button class="btn btn-primary">Preview import</button>
			</form>
		</div>
		{#if importError}
			<p class="notice notice-warn mt-4" role="alert" data-testid="import-error">{importError}</p>
		{/if}
	</div>
</section>

{#snippet planList(
	title: string,
	id: string,
	items: PlanRow[],
	opts: { open?: boolean; note?: string }
)}
	{#if items.length}
		<details class="rounded-lg border border-line" open={opts.open} data-testid="import-{id}">
			<summary class="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium">
				{title}
				<span class="pill num">{items.length}</span>
			</summary>
			{#if opts.note}<p class="hint px-3">{opts.note}</p>{/if}
			<ul class="divide-y divide-line px-3 pb-1 text-sm">
				{#each items.slice(0, LIST_CAP) as item (item.rule.pattern + item.rule.matchType)}
					<li class="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
						<span class="font-mono font-medium break-all">{item.rule.pattern}</span>
						<span class="pill">{item.rule.matchType}</span>
						{#if item.rule.direction !== 'any'}<span class="pill">{item.rule.direction}</span>{/if}
						<span>→ {item.rule.categorySlug}</span>
						{#if item.rule.person}<span class="pill pill-ok">{item.rule.person}</span>{/if}
						{#if !item.rule.isActive}<span class="pill pill-warn">inactive</span>{/if}
						{#if item.differences}
							<span class="basis-full text-xs text-ink-soft"
								>Differs from yours: {item.differences.join('; ')}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
			{#if items.length > LIST_CAP}
				<p class="hint px-3 pb-2">Showing the first {LIST_CAP} of {items.length}.</p>
			{/if}
		</details>
	{/if}
{/snippet}

{#if importResult}
	<section class="card mt-8 p-5" aria-labelledby="import-done" data-testid="import-result">
		<h2 id="import-done" tabindex="-1" class="section-title">Import finished</h2>
		<dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
			{#each [['Rules created', importResult.createdRules, 'created'], ['Rules updated', importResult.updatedRules, 'updated'], ['Skipped (identical)', importResult.identicalSkipped, 'identical'], ['Conflicts kept as yours', importResult.conflictsKept, 'kept'], ['Categories created', importResult.categoriesCreated, 'categories'], ['Skipped (invalid)', importResult.skippedInvalid, 'invalid'], ['Skipped (no category)', importResult.skippedMissingCategory, 'nocat'], ['Rows recategorised', importResult.recategorised ?? 0, 'recategorised']] as [label, value, key] (key)}
				<div class="rounded-lg border border-line p-3">
					<dt class="text-xs text-ink-soft">{label}</dt>
					<dd class="num mt-1 text-2xl font-semibold" data-testid="result-{key}">{value}</dd>
				</div>
			{/each}
		</dl>
		{#if importResult.recategorised === null}
			<p class="hint">Rules were not re-applied; use "Re-apply rules" to update existing rows.</p>
		{/if}
	</section>
{/if}

{#if preview}
	<section class="card mt-8 p-5" aria-labelledby="import-preview" data-testid="import-preview">
		<h2 id="import-preview" tabindex="-1" class="section-title">Import preview</h2>
		<p class="mt-1 text-sm text-ink-soft">
			{preview.filename}: {preview.counts.rules} rules, {preview.counts.categories} categories. Nothing
			has been written yet.
		</p>
		<ul class="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Summary">
			<li class="pill pill-ok"><span class="num">{preview.plan.newRules.length}</span>&nbsp;new</li>
			<li class="pill"><span class="num">{preview.plan.identical.length}</span>&nbsp;identical</li>
			<li class="pill {preview.plan.conflicts.length ? 'pill-warn' : ''}">
				<span class="num">{preview.plan.conflicts.length}</span>&nbsp;conflicts
			</li>
			<li class="pill">
				<span class="num">{preview.plan.missingCategory.length}</span>&nbsp;need a category
			</li>
			<li class="pill {preview.plan.invalid.length ? 'pill-warn' : ''}">
				<span class="num">{preview.plan.invalid.length}</span>&nbsp;invalid
			</li>
		</ul>

		<div class="mt-4 space-y-2">
			{@render planList('New rules', 'new', preview.plan.newRules, { open: true })}
			{@render planList('Conflicts with your rules', 'conflicts', preview.plan.conflicts, {
				open: true,
				note: 'Same pattern and match type, different settings.'
			})}
			{@render planList(
				'Rules whose category does not exist here',
				'missing',
				preview.plan.missingCategory,
				{
					open: true,
					note: preview.plan.categoriesToCreate.length
						? `The file defines: ${preview.plan.categoriesToCreate.map((c) => c.name).join(', ')}.`
						: undefined
				}
			)}
			{@render planList(
				'Identical to your rules (skipped)',
				'identical',
				preview.plan.identical,
				{}
			)}
			{#if preview.plan.invalid.length}
				<details class="rounded-lg border border-attention-600" open data-testid="import-invalid">
					<summary class="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium">
						Invalid entries (skipped)
						<span class="pill pill-warn num">{preview.plan.invalid.length}</span>
					</summary>
					<ul class="divide-y divide-line px-3 pb-1 text-sm">
						{#each preview.plan.invalid.slice(0, LIST_CAP) as bad, i (i)}
							<li class="py-2">
								<span class="font-mono break-all">{bad.label}</span>
								<span class="text-xs text-ink-soft">({bad.kind} {bad.index})</span>
								<span class="block text-attention-600">{bad.reason}</span>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>

		{#if preview.plan.newRules.length + preview.plan.missingCategory.length + preview.plan.conflicts.length === 0}
			<p class="notice notice-ok mt-4" role="status" data-testid="import-nothing">
				{preview.plan.invalid.length
					? 'Nothing to import: no entry in the file can be added. Fix the invalid entries and try again.'
					: 'Nothing to import: everything in the file is already here.'}
			</p>
		{:else}
			<form
				method="POST"
				action="?/confirmImport"
				use:enhance
				class="mt-5 space-y-4 border-t border-line pt-4"
			>
				<input type="hidden" name="payload" value={preview.payload} />
				<input type="hidden" name="expectedInvalid" value={preview.planInvalidCount} />
				<input type="hidden" name="fileInvalid" value={preview.fileInvalid.length} />
				<fieldset class="space-y-1">
					<legend class="label">When a rule already exists with different settings</legend>
					<label class="flex min-h-11 items-center gap-2 text-sm">
						<input
							type="radio"
							name="conflicts"
							value="keep"
							checked
							class="size-5 border-line-strong text-primary-600 focus:ring-primary-500"
						/>
						Keep mine (default)
					</label>
					<label class="flex min-h-11 items-center gap-2 text-sm">
						<input
							type="radio"
							name="conflicts"
							value="imported"
							class="size-5 border-line-strong text-primary-600 focus:ring-primary-500"
						/>
						Use the imported version
					</label>
				</fieldset>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="createMissing"
						checked
						class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
					/>
					Create the missing categories from the file ({preview.plan.categoriesToCreate.length})
				</label>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="reapply"
						checked
						class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
					/>
					Re-apply rules to uncategorised and rule-set rows after import
				</label>
				<p class="hint">
					Everything is written in one step: if anything fails, nothing changes. Rows you
					categorised by hand are never touched; rows set by a rule that no longer matches go back
					to uncategorised.
				</p>
				<div class="flex flex-wrap gap-3">
					<button class="btn btn-primary">Import now</button>
					<a class="btn" href={resolve('/admin/rules')}>Cancel</a>
				</div>
			</form>
		{/if}
	</section>
{/if}

<section class="mt-10" aria-labelledby="new">
	<h2 id="new" class="section-title">New rule</h2>
	<form method="POST" action="?/create" use:enhance class="card mt-3 space-y-4 p-5">
		{@render ruleFields('new', valuesFor('create', null), errorsFor('create', null))}
		<button class="btn btn-primary">Add rule</button>
	</form>
</section>

<section class="mt-10" aria-labelledby="list">
	<h2 id="list" class="section-title">All rules ({data.rules.length})</h2>
	<ol class="card mt-3 divide-y divide-line">
		{#each data.rules as rule, i (rule.id)}
			<li class="px-4 py-3">
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
				<details class="mt-1" open={form?.action === 'update' && form.id === rule.id}>
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
