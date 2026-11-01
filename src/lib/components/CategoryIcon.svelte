<script lang="ts">
	import { ICONS, UNCATEGORISED_ICON, resolveIcon } from '#lib/icons/registry.ts';

	interface Props {
		/** Stored icon key (may be null/unknown: falls back to the slug default, then a tag). */
		icon?: string | null;
		slug?: string | null;
		/** Stored category colour; null renders the neutral "uncategorised" look. */
		color?: string | null;
		/** `sm` 16px, `md` 20px, `lg` 24px glyph. */
		size?: 'sm' | 'md' | 'lg';
		/** Draw the glyph on a tinted round badge (the category colour at low opacity). */
		badge?: boolean;
		/** Set when the icon stands alone (no category name beside it); otherwise it is decorative. */
		label?: string;
	}
	let {
		icon = null,
		slug = null,
		color = null,
		size = 'sm',
		badge = false,
		label
	}: Props = $props();

	const key = $derived(color === null && !icon ? UNCATEGORISED_ICON : resolveIcon(icon, slug));
	const nodes = $derived(ICONS[key].nodes);
	const glyph = { sm: 'size-4', md: 'size-5', lg: 'size-6' } as const;
	const box = { sm: 'size-7', md: 'size-8', lg: 'size-10' } as const;
</script>

<span
	class="inline-flex shrink-0 items-center justify-center {badge
		? `${box[size]} rounded-full ${color ? 'cat-badge' : 'bg-paper'}`
		: ''} {color ? 'cat-ink' : 'text-ink-soft'}"
	style:--cat={color}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-icon={key}
>
	<svg
		class={glyph[size]}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		{#each nodes as [tag, attrs], i (i)}
			<svelte:element this={tag} {...attrs} />
		{/each}
	</svg>
</span>
