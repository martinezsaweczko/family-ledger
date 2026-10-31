<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { formatPercent } from '#lib/format/number.ts';

	interface Props {
		statementId: number;
		/** Whole percent (0-100). */
		confidence: number | null;
		/** Offer the one-click Accept (needs a page that exports the shared override actions). */
		editable?: boolean;
		suggestedPattern?: string;
	}
	let { statementId, confidence, editable = false, suggestedPattern = '' }: Props = $props();

	const uid = $props.id();
	let withRule = $state(false);
	let busy = $state(false);

	const action = `${page.url.pathname}${page.url.search ? `${page.url.search}&` : '?'}/acceptAi`;
	const label = $derived(
		confidence === null ? 'AI' : `AI · ${formatPercent(confidence / 100).replace(/\s/g, ' ')}`
	);
	const ov = $derived(
		page.form && 'override' in page.form
			? (page.form.override as { statementId?: number; error?: string })
			: null
	);
	const error = $derived(ov && ov.statementId === statementId ? ov.error : undefined);
</script>

<span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
	<span
		class="pill bg-highlight-100 text-ink"
		data-testid="badge-ai"
		title="Suggested by the AI; confirm it with Accept or pick another category">{label}</span
	>
	{#if editable}
		<form
			method="POST"
			{action}
			class="inline-flex flex-wrap items-center gap-2"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			<input type="hidden" name="statementId" value={statementId} />
			<button
				type="submit"
				class="inline-flex min-h-8 cursor-pointer items-center rounded px-1 text-xs font-medium text-primary-700 underline decoration-line underline-offset-4 hover:decoration-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
				disabled={busy}
				data-testid="accept-ai"
				aria-label="Accept the AI category">{busy ? 'Saving…' : 'Accept'}</button
			>
			{#if suggestedPattern}
				<label for="{uid}-rule" class="inline-flex min-h-8 items-center gap-1.5 text-xs">
					<input
						id="{uid}-rule"
						type="checkbox"
						name="createRule"
						bind:checked={withRule}
						class="rounded border-line text-primary-600 focus:ring-primary-500"
					/>
					also create a rule
				</label>
				<input type="hidden" name="pattern" value={suggestedPattern} />
			{/if}
		</form>
		{#if error}<span class="field-error text-xs" role="alert">{error}</span>{/if}
	{/if}
</span>
