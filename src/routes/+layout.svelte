<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/', label: 'Home' } as const,
		{ href: '/dashboard', label: 'Dashboard' } as const,
		{ href: '/dashboard/transactions', label: 'Transactions' } as const,
		{ href: '/admin', label: 'Admin' } as const
	];
	const current = (href: string) => {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		if (href === '/dashboard')
			return path.startsWith('/dashboard') && !path.startsWith('/dashboard/transactions');
		return path.startsWith(href);
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a
	href="#content"
	class="sr-only z-50 rounded-lg bg-card px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
>
	Skip to content
</a>

<header class="border-b border-line bg-card">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-0 px-5">
		<a
			href={resolve('/')}
			class="py-3 text-sm font-semibold tracking-widest text-primary-600 uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
		>
			Hearth
		</a>
		<nav
			aria-label="Main"
			class="order-3 -mb-px flex w-full flex-wrap gap-1 sm:order-none sm:w-auto"
		>
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
		<div class="my-1 ml-auto sm:order-none">
			<ThemeToggle />
		</div>
	</div>
</header>

<div>
	{@render children()}
</div>
