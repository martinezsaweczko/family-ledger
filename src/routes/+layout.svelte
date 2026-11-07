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

<header class="bg-card">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-0 px-5">
		<a
			href={resolve('/')}
			class="flex items-center gap-2 rounded-lg py-3 text-lg font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
		>
			<svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
				<rect width="24" height="24" rx="7" fill="var(--color-primary-600)" />
				<path
					d="M7 12.2 12 7.5l5 4.7V17a.8.8 0 0 1-.8.8h-2.7v-3.6h-3v3.6H7.8A.8.8 0 0 1 7 17z"
					fill="var(--color-on-primary)"
				/>
			</svg>
			Hearth
		</a>
		<nav
			aria-label="Main"
			class="order-3 flex w-full flex-wrap gap-0.5 pb-2 sm:order-none sm:w-auto sm:gap-1 sm:pb-0"
		>
			{#each links as link (link.href)}
				<a
					href={resolve(link.href)}
					aria-current={current(link.href) ? 'page' : undefined}
					class="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600 sm:px-4 {current(
						link.href
					)
						? 'bg-primary-50 text-primary-700'
						: 'text-ink-soft hover:bg-paper hover:text-ink'}"
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
