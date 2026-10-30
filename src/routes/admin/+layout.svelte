<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/admin', label: 'Imports' } as const,
		{ href: '/admin/review', label: 'Review' } as const,
		{ href: '/admin/categories', label: 'Categories' } as const,
		{ href: '/admin/rules', label: 'Rules' } as const
	];
	const current = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<a
	href="#content"
	class="sr-only rounded-lg bg-card px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
>
	Skip to content
</a>

<header class="border-b border-line bg-card">
	<div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-1 px-5">
		<a
			href={resolve('/')}
			class="py-3 text-sm font-semibold tracking-widest text-primary-600 uppercase"
		>
			Hearth <span class="text-ink-soft normal-case">· Admin</span>
		</a>
		<nav aria-label="Admin" class="-mb-px flex flex-wrap gap-1">
			{#each links as link (link.href)}
				<a
					href={resolve(link.href)}
					aria-current={current(link.href) ? 'page' : undefined}
					class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600 {current(
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
</header>

<main id="content" class="mx-auto max-w-5xl px-5 py-8 sm:py-10">
	{@render children()}
</main>
