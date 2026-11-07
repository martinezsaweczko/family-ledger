<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/admin', label: 'Imports' } as const,
		{ href: '/admin/review', label: 'Review' } as const,
		{ href: '/admin/categories', label: 'Categories' } as const,
		{ href: '/admin/manual', label: 'Manual' } as const,
		{ href: '/admin/rules', label: 'Rules' } as const
	];
	const current = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<div class="border-b border-line bg-card">
	<nav aria-label="Admin" class="mx-auto flex max-w-5xl gap-x-1 overflow-x-auto px-2 sm:px-5">
		{#each links as link (link.href)}
			<a
				href={resolve(link.href)}
				aria-current={current(link.href) ? 'page' : undefined}
				class="-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600 {current(
					link.href
				)
					? 'border-primary-600 text-primary-700'
					: 'border-transparent text-ink-soft hover:text-ink'}"
			>
				{link.label}
			</a>
		{/each}
	</nav>
</div>

<main id="content" class="mx-auto max-w-5xl px-5 py-8 sm:py-10">
	{@render children()}
</main>
