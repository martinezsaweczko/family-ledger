<script lang="ts">
	interface Props {
		page: number;
		pageSize: number;
		total: number;
		/** Builds the href for a page number, preserving other query params. */
		href: (page: number) => string;
	}
	let { page, pageSize, total, href }: Props = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const first = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const last = $derived(Math.min(total, page * pageSize));
</script>

<nav class="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
	<p class="num text-ink-soft">{first}–{last} of {total}</p>
	<div class="flex gap-2">
		{#if page > 1}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes resolved hrefs -->
			<a class="btn" href={href(page - 1)} rel="prev">Previous</a>
		{/if}
		{#if page < pages}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes resolved hrefs -->
			<a class="btn" href={href(page + 1)} rel="next">Next</a>
		{/if}
	</div>
</nav>
