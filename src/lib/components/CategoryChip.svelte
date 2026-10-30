<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		name: string;
		color: string | null;
		slug: string | null;
		/** Query string (with `?`) appended to the drill-down link so filters carry over. */
		search?: string;
	}
	let { name, color, slug, search = '' }: Props = $props();
</script>

<span class="inline-flex min-w-0 items-center gap-2">
	<span
		class="size-2.5 shrink-0 rounded-full {color ? '' : 'bg-ink-soft'}"
		style:background-color={color}
		aria-hidden="true"
	></span>
	{#if slug}
		<a
			href="{resolve('/dashboard/category/[slug]', { slug })}{search}"
			class="truncate font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
			>{name}</a
		>
	{:else}
		<span class="truncate font-medium text-ink">{name}</span>
	{/if}
</span>
