<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { describeAiResult } from '#lib/format/ai-summary.ts';
	import { formatDateTime } from '#lib/format/date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let input = $state<HTMLInputElement>();
	let names = $state<string[]>([]);
	let dragging = $state(false);
	let busy = $state(false);
	let testing = $state(false);
	const aiTest = $derived(form && 'aiTest' in form ? form.aiTest : null);
	const results = $derived(form && 'results' in form ? form.results : []);

	const sync = () => (names = Array.from(input?.files ?? [], (f) => f.name));
	function drop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		if (input && event.dataTransfer?.files.length) {
			input.files = event.dataTransfer.files;
			sync();
		}
	}
	const mask = (iban: string) => `••••${iban.slice(-4)}`;
	const when = (value: string | Date) => formatDateTime(value);
</script>

<svelte:head>
	<title>Imports · Hearth admin</title>
</svelte:head>

<h1 class="page-title">Import statements</h1>
<p class="page-lead">
	Upload one or more bank exports. The format is detected automatically. Re-uploading a file or an
	overlapping export never counts a movement twice.
</p>

<form
	method="POST"
	action="?/upload"
	enctype="multipart/form-data"
	class="mt-6"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: true });
			names = [];
			busy = false;
		};
	}}
>
	<label
		for="files"
		class="card flex cursor-pointer flex-col items-center gap-2 border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-600 {dragging
			? 'border-primary-500 bg-primary-50'
			: ''}"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={drop}
	>
		<span class="text-base font-medium">Drop bank files here or choose them</span>
		<span class="text-sm text-ink-soft">
			Accepted: {data.importers.flatMap((i) => i.accepts).join(', ')} · several files at once
		</span>
		<input
			bind:this={input}
			onchange={sync}
			id="files"
			name="files"
			type="file"
			multiple
			required
			accept={data.importers.flatMap((i) => i.accepts).join(',')}
			class="mt-2 max-w-full text-sm text-ink-soft file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:text-sm file:font-medium file:text-on-primary hover:file:bg-primary-700"
		/>
	</label>
	{#if names.length}
		<ul class="mt-3 text-sm text-ink-soft" aria-label="Selected files">
			{#each names as name (name)}<li>{name}</li>{/each}
		</ul>
	{/if}
	<button class="btn btn-primary mt-4" disabled={busy || names.length === 0}>
		{busy ? 'Importing…' : 'Import files'}
	</button>
</form>

<div aria-live="polite" class="mt-6 space-y-4">
	{#if form && 'message' in form && form.message}
		<p class="notice notice-warn">{form.message}</p>
	{/if}
	{#each results as result (result.filename)}
		{#if result.ok}
			<article class="card p-5" aria-label="Result for {result.filename}">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold break-all">{result.filename}</h2>
					<span class="pill pill-ok">Imported</span>
				</div>
				<p class="mt-1 text-sm text-ink-soft">
					{result.summary.importerId} · account {mask(result.summary.iban)}
				</p>
				<dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
					{#each [['Rows', result.summary.rowsTotal], ['Inserted', result.summary.rowsInserted], ['Updated', result.summary.rowsUpdated], ['Unchanged', result.summary.rowsUnchanged], ['Uncategorised', result.uncategorised]] as [label, value] (label)}
						<div>
							<dt class="text-xs font-medium text-ink-soft">{label}</dt>
							<dd class="num text-2xl font-semibold" data-stat={label}>{value}</dd>
						</div>
					{/each}
				</dl>
				{#if result.summary.ai.enabled && result.summary.ai.requested > 0}
					<p class="mt-4 text-sm" data-testid="ai-summary">
						<span class="pill bg-highlight-100 text-ink">AI</span>
						{describeAiResult(result.summary.ai)}
					</p>
				{/if}
				{#if result.uncategorised > 0}
					<p class="mt-4 text-sm">
						<a class="font-medium text-primary-700 underline" href={resolve('/admin/review')}>
							Review {result.uncategorised} uncategorised rows
						</a>
					</p>
				{/if}
			</article>
		{:else}
			<article class="notice notice-warn" aria-label="Error for {result.filename}">
				<h2 class="font-semibold break-all">{result.filename}</h2>
				<p class="mt-1">{result.error}</p>
			</article>
		{/if}
	{/each}
</div>

<section class="mt-10" aria-labelledby="ai-status" data-testid="ai-status">
	<h2 id="ai-status" class="section-title">AI categorisation</h2>
	{#if data.ai.enabled}
		<p class="mt-1 text-sm text-ink-soft">
			<span class="pill pill-ok">Enabled</span>
			Model <span class="font-medium text-ink">{data.ai.model}</span> via
			<span class="font-medium text-ink">{data.ai.host}</span>. Uncategorised rows are sent as
			cleaned merchant text only (no digits, IBANs or dates), after each import and from the review
			page.
		</p>
		<p class="mt-2 text-sm text-ink-soft" data-testid="ai-last">
			{data.ai.last
				? `Last run ${formatDateTime(data.ai.last.at)}: ${data.ai.last.summary}`
				: 'No run since the server started.'}
		</p>
		<form
			method="POST"
			action="?/testAi"
			class="mt-3"
			use:enhance={() => {
				testing = true;
				return async ({ update }) => {
					await update({ reset: false });
					testing = false;
				};
			}}
		>
			<button class="btn" disabled={testing} data-testid="ai-test">
				{testing ? 'Testing…' : 'Test connection'}
			</button>
		</form>
		{#if aiTest}
			<p
				class="notice mt-3 {aiTest.ok ? 'notice-ok' : 'notice-warn'}"
				role="status"
				data-testid="ai-test-result"
			>
				{aiTest.message}
			</p>
		{/if}
	{:else}
		<p class="mt-1 text-sm text-ink-soft" data-testid="ai-disabled">
			<span class="pill">Disabled</span>
			Set <code>AI_BASE_URL</code> (see the README) to let an OpenAI-compatible service suggest categories
			for rows the rules cannot place.
		</p>
	{/if}
</section>

<section class="mt-10" aria-labelledby="supported">
	<h2 id="supported" class="section-title">Supported formats</h2>
	<p class="mt-1 text-sm text-ink-soft">
		Each bank is a small plug-in; adding one adds it to this list.
	</p>
	<ul class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each data.importers as importer (importer.id)}
			<li class="card p-4">
				<p class="font-medium">{importer.label}</p>
				<p class="text-sm text-ink-soft">{importer.id} · {importer.accepts.join(', ')}</p>
			</li>
		{/each}
	</ul>
</section>

<section class="mt-10" aria-labelledby="history">
	<h2 id="history" class="section-title">Import history</h2>
	{#if data.batches.length === 0}
		<p class="card mt-3 p-5 text-sm text-ink-soft">Nothing imported yet.</p>
	{:else}
		<div class="card mt-3 overflow-x-auto">
			<table class="w-full min-w-xl text-left text-sm">
				<caption class="sr-only">Latest imports, newest first</caption>
				<thead class="border-b border-line text-xs text-ink-soft">
					<tr>
						<th scope="col" class="px-4 py-3 font-medium">File</th>
						<th scope="col" class="px-4 py-3 font-medium">When</th>
						<th scope="col" class="px-4 py-3 font-medium">Account</th>
						<th scope="col" class="px-4 py-3 text-right font-medium">Rows</th>
						<th scope="col" class="px-4 py-3 text-right font-medium">New</th>
						<th scope="col" class="px-4 py-3 text-right font-medium">Updated</th>
						<th scope="col" class="px-4 py-3 text-right font-medium">Same</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each data.batches as batch (batch.id)}
						<tr>
							<td class="max-w-56 truncate px-4 py-3" title={batch.filename}>{batch.filename}</td>
							<td class="px-4 py-3 whitespace-nowrap text-ink-soft">{when(batch.importedAt)}</td>
							<td class="num px-4 py-3 text-ink-soft">{mask(batch.iban)}</td>
							<td class="num px-4 py-3 text-right">{batch.rowsTotal}</td>
							<td class="num px-4 py-3 text-right">{batch.rowsInserted}</td>
							<td class="num px-4 py-3 text-right">{batch.rowsUpdated}</td>
							<td class="num px-4 py-3 text-right">{batch.rowsUnchanged}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
