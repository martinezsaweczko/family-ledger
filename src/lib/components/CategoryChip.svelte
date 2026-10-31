<script lang="ts">
	import { resolve } from '$app/paths';
	import CategoryIcon from './CategoryIcon.svelte';

	interface Props {
		name: string;
		color: string | null;
		slug: string | null;
		/** Stored icon key; null falls back to the slug default. */
		icon?: string | null;
		/** Query string (with `?`) appended to the drill-down link so filters carry over. */
		search?: string;
	}
	let { name, color, slug, icon = null, search = '' }: Props = $props();
</script>

<span class="inline-flex min-w-0 items-center gap-2">
	<CategoryIcon {icon} {slug} {color} size="sm" badge />
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
