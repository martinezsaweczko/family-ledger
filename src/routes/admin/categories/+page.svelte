<script lang="ts">
	import { enhance } from '$app/forms';
	import CategoryIcon from '#lib/components/CategoryIcon.svelte';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import IconPicker from '#lib/components/IconPicker.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const kinds = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer (excluded from totals)' },
		{ value: 'ignore', label: 'Ignore (excluded from totals)' }
	];

	let newColor = $state('#0F9488');
	let editColors = $state<Record<number, string>>({});
	let newIcon = $state('');
	let editIcons = $state<Record<number, string>>({});
	// Live name per form (for the icon preview); falls back to the saved name.
	let names = $state<Record<string, string>>({});

	const errorsFor = (action: string, id: number | null) =>
		form && 'errors' in form && form.action === action && ('id' in form ? form.id === id : true)
			? (form.errors as Record<string, string>)
			: {};
	const active = $derived(data.categories.filter((c) => c.isActive));
	const archived = $derived(data.categories.filter((c) => !c.isActive));
</script>

{#snippet fields(prefix: string, v: Record<string, string>, errors: Record<string, string>)}
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="{prefix}-name">Name</label>
			<input
				id="{prefix}-name"
				name="name"
				class="field"
				value={v.name ?? ''}
				maxlength="80"
				required
				oninput={(e) => (names[prefix] = e.currentTarget.value)}
				aria-invalid={errors.name ? 'true' : undefined}
			/>
			{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-kind">Kind</label>
			<select id="{prefix}-kind" name="kind" class="field" required>
				{#each kinds as k (k.value)}
					<option value={k.value} selected={(v.kind ?? 'expense') === k.value}>{k.label}</option>
				{/each}
			</select>
			{#if errors.kind}<p class="field-error">{errors.kind}</p>{/if}
		</div>
		<div>
			<label class="label" for="{prefix}-sort">Sort order</label>
			<input
				id="{prefix}-sort"
				name="sortOrder"
				type="number"
				inputmode="numeric"
				class="field num max-w-32"
				value={v.sortOrder ?? '0'}
			/>
			{#if errors.sortOrder}<p class="field-error">{errors.sortOrder}</p>{/if}
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>Categories · Hearth admin</title>
</svelte:head>

<h1 class="page-title">Categories</h1>
<p class="page-lead">
	Archiving hides a category from pickers; its statements and rules stay as they are.
</p>

<div aria-live="polite" class="mt-4">
	{#if form && 'saved' in form && form.saved}
		<p class="notice notice-ok" role="status">{form.saved}: done.</p>
	{/if}
	{#if form && 'errors' in form && form.errors && '_form' in form.errors}
		<p class="notice notice-warn" role="alert">{form.errors._form}</p>
	{/if}
</div>

<section class="mt-8" aria-labelledby="new">
	<h2 id="new" class="section-title">New category</h2>
	<form method="POST" action="?/create" use:enhance class="card mt-3 space-y-4 p-5">
		{@render fields(
			'new',
			form?.action === 'create' && 'values' in form ? (form.values ?? {}) : {},
			errorsFor('create', null)
		)}
		<ColorPicker name="color" bind:value={newColor} error={errorsFor('create', null).color} />
		<IconPicker
			bind:value={newIcon}
			color={newColor}
			categoryName={names.new ?? ''}
			error={errorsFor('create', null).icon}
		/>
		<button class="btn btn-primary">Add category</button>
	</form>
</section>

<section class="mt-10" aria-labelledby="list">
	<h2 id="list" class="section-title">Active ({active.length})</h2>
	<ul class="card mt-3 divide-y divide-line">
		{#each active as c (c.id)}
			<li class="px-4 py-3">
				<div class="flex flex-wrap items-center gap-3">
					<CategoryIcon icon={c.icon} slug={c.slug} color={c.color} size="md" badge />
					<p class="font-medium">{c.name}</p>
					<span class="pill">{c.kind}</span>
					<span class="num text-sm text-ink-soft">{c.statementCount} statements</span>
					<form method="POST" action="?/archive" use:enhance class="ml-auto">
						<input type="hidden" name="id" value={c.id} />
						<button class="btn" aria-label="Archive {c.name}">Archive</button>
					</form>
				</div>
				<details class="mt-3">
					<summary
						class="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-700"
					>
						Edit {c.name}
					</summary>
					<form method="POST" action="?/update" use:enhance class="mt-3 space-y-4">
						<input type="hidden" name="id" value={c.id} />
						{@render fields(
							`edit-${c.id}`,
							form?.action === 'update' && 'values' in form && form.id === c.id
								? (form.values ?? {})
								: { name: c.name, kind: c.kind, sortOrder: String(c.sortOrder) },
							errorsFor('update', c.id)
						)}
						<ColorPicker
							name="color"
							bind:value={() => editColors[c.id] ?? c.color, (v) => (editColors[c.id] = v)}
							error={errorsFor('update', c.id).color}
						/>
						<IconPicker
							bind:value={() => editIcons[c.id] ?? c.icon ?? '', (v) => (editIcons[c.id] = v)}
							color={editColors[c.id] ?? c.color}
							categoryName={names[`edit-${c.id}`] ?? c.name}
							slug={c.slug}
							error={errorsFor('update', c.id).icon}
						/>
						<button class="btn btn-primary">Save changes</button>
					</form>
				</details>
			</li>
		{/each}
	</ul>
</section>

{#if archived.length}
	<section class="mt-10" aria-labelledby="archived">
		<h2 id="archived" class="section-title">Archived ({archived.length})</h2>
		<ul class="card mt-3 divide-y divide-line">
			{#each archived as c (c.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3">
					<span class="opacity-60"
						><CategoryIcon icon={c.icon} slug={c.slug} color={c.color} size="md" badge /></span
					>
					<p class="font-medium text-ink-soft">{c.name}</p>
					<span class="pill">{c.kind}</span>
					<span class="num text-sm text-ink-soft">{c.statementCount} statements kept</span>
					<form method="POST" action="?/restore" use:enhance class="ml-auto">
						<input type="hidden" name="id" value={c.id} />
						<button class="btn" aria-label="Restore {c.name}">Restore</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}
