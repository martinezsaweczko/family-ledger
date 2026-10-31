<script lang="ts">
	import { ICONS, PICKABLE_ICON_KEYS, resolveIcon, type IconKey } from '#lib/icons/registry.ts';
	import CategoryIcon from './CategoryIcon.svelte';

	interface Props {
		/** Form field name (`icon`). Empty value = "automatic" (slug default / generic tag). */
		name?: string;
		value: string;
		/** Live preview inputs. */
		color: string;
		categoryName: string;
		slug?: string | null;
		error?: string;
	}
	let {
		name = 'icon',
		value = $bindable(),
		color,
		categoryName,
		slug = null,
		error
	}: Props = $props();

	const uid = $props.id();
	let query = $state('');
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return PICKABLE_ICON_KEYS.filter(
			(k) => !q || k.includes(q) || ICONS[k].label.toLowerCase().includes(q)
		);
	});
	const previewKey = $derived<IconKey>(resolveIcon(value, slug));
</script>

<fieldset>
	<legend class="label">Icon</legend>
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2" data-testid="icon-preview">
			<CategoryIcon icon={previewKey} {color} size="lg" badge />
			<span class="text-sm font-medium">{categoryName || 'Category name'}</span>
		</div>
		<div class="min-w-48 flex-1 sm:max-w-xs">
			<label class="sr-only" for="{uid}-search">Filter icons</label>
			<input
				id="{uid}-search"
				type="search"
				class="field"
				placeholder="Filter icons…"
				autocomplete="off"
				spellcheck="false"
				bind:value={query}
			/>
		</div>
	</div>
	<input type="hidden" {name} {value} />
	<div
		class="mt-2 flex max-h-48 flex-wrap gap-1 overflow-y-auto rounded-lg border border-line p-1"
		role="radiogroup"
		aria-label="Icon choices"
	>
		<label class="relative inline-flex min-h-11 cursor-pointer items-center">
			<input
				type="radio"
				class="peer sr-only"
				name="{uid}-icon"
				value=""
				checked={value === ''}
				onchange={() => (value = '')}
			/>
			<span
				class="inline-flex h-11 items-center rounded-lg px-3 text-sm text-ink-soft peer-checked:bg-primary-50 peer-checked:font-medium peer-checked:text-primary-700 peer-focus-visible:outline-2 peer-focus-visible:outline-primary-600"
				>Automatic</span
			>
		</label>
		{#each shown as key (key)}
			<label class="relative inline-flex size-11 cursor-pointer items-center justify-center">
				<input
					type="radio"
					class="peer sr-only"
					name="{uid}-icon"
					value={key}
					checked={value === key}
					onchange={() => (value = key)}
				/>
				<span
					class="inline-flex size-10 items-center justify-center rounded-lg text-ink peer-checked:bg-primary-50 peer-checked:text-primary-700 peer-checked:ring-2 peer-checked:ring-primary-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-600 hover:bg-paper"
				>
					<CategoryIcon icon={key} size="md" />
				</span>
				<span class="sr-only">{ICONS[key].label}</span>
			</label>
		{/each}
	</div>
	<p class="hint" role="status">
		{shown.length === 0 ? 'No icon matches this filter.' : `${shown.length} icons shown.`}
	</p>
	{#if error}<p class="field-error">{error}</p>{/if}
</fieldset>
