<script lang="ts">
	import {
		applyTheme,
		readStoredPref,
		storePref,
		THEME_KEY,
		type ThemePref
	} from '#lib/theme/theme.ts';

	const OPTIONS: { value: ThemePref; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	// The server cannot know the preference; the inline script in app.html already painted the right
	// theme, this only syncs the control after hydration.
	let pref = $state<ThemePref>('system');

	$effect(() => {
		pref = readStoredPref();
		const query = matchMedia('(prefers-color-scheme: dark)');
		// Only System follows the OS live; explicit choices stay put.
		const onSystem = () => {
			if (pref === 'system') applyTheme('system');
		};
		const onStorage = (e: StorageEvent) => {
			if (e.key !== THEME_KEY && e.key !== null) return;
			pref = readStoredPref();
			applyTheme(pref);
		};
		query.addEventListener('change', onSystem);
		addEventListener('storage', onStorage);
		return () => {
			query.removeEventListener('change', onSystem);
			removeEventListener('storage', onStorage);
		};
	});

	function choose(value: ThemePref) {
		pref = value;
		storePref(value);
		applyTheme(value, true);
	}
</script>

<div
	role="group"
	aria-label="Theme"
	class="inline-flex items-center rounded-lg border border-line bg-paper p-0.5"
>
	{#each OPTIONS as o (o.value)}
		<button
			type="button"
			aria-pressed={pref === o.value}
			title={o.label}
			data-theme-option={o.value}
			onclick={() => choose(o.value)}
			class="inline-flex size-11 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600 {pref ===
			o.value
				? 'bg-primary-50 text-primary-700'
				: 'text-ink-soft hover:bg-card hover:text-ink'}"
		>
			<span class="sr-only">{o.label}</span>
			<svg
				viewBox="0 0 24 24"
				class="size-5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				focusable="false"
			>
				{#if o.value === 'light'}
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
					/>
				{:else if o.value === 'dark'}
					<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
				{:else}
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path d="M8 20h8M12 16v4" />
				{/if}
			</svg>
		</button>
	{/each}
</div>
