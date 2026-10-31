<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	export interface EditorCategory {
		id: number;
		name: string;
		isActive: boolean;
	}
	interface Props {
		statementId: number;
		concept: string;
		categoryId: number | null;
		categories: EditorCategory[];
		suggestedPattern: string;
		/** True when the user chose the category (offers "Remove my change"). */
		canClear: boolean;
		/** Called after a successful save/undo so the table can collapse the panel. */
		onclose?: () => void;
		id?: string;
	}
	let {
		statementId,
		concept,
		categoryId,
		categories,
		suggestedPattern,
		canClear,
		onclose,
		id
	}: Props = $props();

	const uid = $props.id();
	let withRule = $state(false);
	let busy = $state(false);

	/** Posts to the CURRENT url (query string kept) with the action name as a `/name` key. */
	const action = (name: string) =>
		`${page.url.pathname}${page.url.search ? `${page.url.search}&` : '?'}/${name}`;
	const choices = $derived(categories.filter((c) => c.isActive || c.id === categoryId));
	const ov = $derived(
		page.form && 'override' in page.form
			? (page.form.override as { statementId?: number; error?: string })
			: null
	);
	const error = $derived(ov && ov.statementId === statementId ? ov.error : undefined);

	const submit = () => {
		busy = true;
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			busy = false;
			if (result.type === 'success') {
				withRule = false;
				onclose?.();
			}
		};
	};
</script>

<section
	{id}
	class="max-w-xl space-y-3 rounded-lg border border-line bg-paper p-3 text-sm"
	aria-label="Change category for {concept}"
	data-testid="row-editor"
>
	<form method="POST" action={action('setCategory')} use:enhance={submit} class="space-y-3">
		<input type="hidden" name="statementId" value={statementId} />
		<div>
			<label class="label" for="{uid}-cat">Category</label>
			<select id="{uid}-cat" name="categoryId" class="field" required>
				<option value="" selected={categoryId === null}>Choose…</option>
				{#each choices as c (c.id)}
					<option value={c.id} selected={c.id === categoryId}>{c.name}</option>
				{/each}
			</select>
		</div>
		<label class="flex min-h-11 items-center gap-2 text-sm">
			<input
				type="checkbox"
				name="createRule"
				class="size-5 rounded border-line text-primary-600 focus:ring-primary-500"
				bind:checked={withRule}
			/>
			Also create a rule from this
		</label>
		{#if withRule}
			<div>
				<label class="label" for="{uid}-pattern">Rule pattern (contains)</label>
				<input
					id="{uid}-pattern"
					name="pattern"
					class="field"
					value={suggestedPattern}
					maxlength="255"
					required
				/>
				<p class="hint">Other rows containing this text are categorised the same way.</p>
			</div>
		{/if}
		<button class="btn btn-primary" disabled={busy}>Save category</button>
	</form>
	{#if canClear}
		<form method="POST" action={action('clearCategory')} use:enhance={submit}>
			<input type="hidden" name="statementId" value={statementId} />
			<button class="btn" disabled={busy}>Remove my change (let rules decide again)</button>
		</form>
	{/if}
	{#if error}<p class="field-error" role="alert">{error}</p>{/if}
</section>
