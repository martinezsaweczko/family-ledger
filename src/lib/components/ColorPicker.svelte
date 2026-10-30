<script lang="ts">
	interface Props {
		name: string;
		value: string;
		label?: string;
		error?: string;
	}
	let { name, value = $bindable(), label = 'Colour', error }: Props = $props();

	// Mid/dark tones with enough contrast on white, same family as the seed categories.
	const swatches: { hex: string; name: string }[] = [
		{ hex: '#0F9488', name: 'Teal' },
		{ hex: '#E08A00', name: 'Amber' },
		{ hex: '#1D4ED8', name: 'Blue' },
		{ hex: '#4F5BD5', name: 'Indigo' },
		{ hex: '#A21CAF', name: 'Magenta' },
		{ hex: '#E11D48', name: 'Rose' },
		{ hex: '#DC2626', name: 'Red' },
		{ hex: '#9A3412', name: 'Rust' },
		{ hex: '#CA8A04', name: 'Gold' },
		{ hex: '#3F6212', name: 'Olive' },
		{ hex: '#059669', name: 'Green' },
		{ hex: '#475569', name: 'Slate' }
	];
	const uid = $props.id();
</script>

<fieldset>
	<legend class="label">{label}</legend>
	<div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="{label} swatches">
		{#each swatches as swatch (swatch.hex)}
			<label class="relative inline-flex size-11 cursor-pointer items-center justify-center">
				<input
					type="radio"
					class="peer sr-only"
					name="{uid}-swatch"
					value={swatch.hex}
					checked={value.toUpperCase() === swatch.hex}
					onchange={() => (value = swatch.hex)}
				/>
				<span
					class="size-8 rounded-full border border-line ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600"
					style:background-color={swatch.hex}
				></span>
				<span class="sr-only">{swatch.name}</span>
			</label>
		{/each}
	</div>
	<div class="mt-2 flex items-center gap-3">
		<span
			class="size-8 shrink-0 rounded-full border border-line"
			style:background-color={/^#[0-9a-f]{3,6}$/i.test(value) ? value : 'transparent'}
			aria-hidden="true"
		></span>
		<label class="sr-only" for="{uid}-hex">{label} hex value</label>
		<input
			id="{uid}-hex"
			{name}
			class="field num max-w-40 font-mono uppercase"
			bind:value
			maxlength="7"
			spellcheck="false"
			autocomplete="off"
			placeholder="#0F9488"
		/>
	</div>
	{#if error}<p class="field-error">{error}</p>{/if}
</fieldset>
