<script lang="ts">
	interface Override {
		statementId?: number;
		saved?: boolean;
		cleared?: boolean;
		error?: string;
		rule?: { pattern: string; created: boolean } | null;
		alsoCategorised?: number;
	}
	let { form }: { form: unknown } = $props();
	const ov = $derived(
		form && typeof form === 'object' && 'override' in form ? (form.override as Override) : null
	);
</script>

<div aria-live="polite" class="mt-4">
	{#if ov?.saved}
		<p class="notice notice-ok" role="status">
			Category changed. It stays this way when you re-import.
			{#if ov.rule}
				{ov.rule.created ? 'Rule created' : 'Existing rule reused'} for “{ov.rule.pattern}”;
				{ov.alsoCategorised ?? 0}
				other {ov.alsoCategorised === 1 ? 'row was' : 'rows were'} categorised.
			{/if}
		</p>
	{:else if ov?.cleared}
		<p class="notice notice-ok" role="status">Your change was removed; the rules decided again.</p>
	{:else if ov?.error && ov.statementId === undefined}
		<p class="notice notice-warn" role="alert">{ov.error}</p>
	{/if}
</div>
