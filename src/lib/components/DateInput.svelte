<script lang="ts">
	import { onMount } from 'svelte';
	import { maskDateInput, parseDate, toDisplayDate } from '#lib/format/date.ts';

	interface Props {
		id: string;
		/** Form field name. The ISO date (`YYYY-MM-DD`) is submitted under this name. */
		name: string;
		/** Initial value, ISO `YYYY-MM-DD` or empty. */
		value?: string;
		required?: boolean;
		/** Server-side error shown by the page; it only marks the field invalid. */
		invalid?: boolean;
		class?: string;
	}
	let {
		id,
		name,
		value = '',
		required = false,
		invalid = false,
		class: klass = ''
	}: Props = $props();

	// The prop only seeds the field; typing owns it afterwards.
	// svelte-ignore state_referenced_locally
	let text = $state(toDisplayDate(value));
	/** False during SSR / before hydration: the visible field then posts dd/mm/yyyy itself. */
	let ready = $state(false);
	let touched = $state(false);
	let field = $state<HTMLInputElement>();
	let picker = $state<HTMLInputElement>();

	const iso = $derived(parseDate(text) ?? '');
	const error = $derived(
		text.trim() !== '' && iso === '' && (touched || text.length >= 10)
			? 'Enter a real date as dd/mm/yyyy.'
			: ''
	);

	onMount(() => {
		// Keep what was typed before hydration finished.
		if (field && field.value && field.value !== text) text = maskDateInput(field.value);
		ready = true;
	});
	// Native validation blocks submit and announces the message; the inline text covers the rest.
	$effect(() => {
		field?.setCustomValidity(
			text.trim() !== '' && iso === '' ? 'Enter a real date as dd/mm/yyyy.' : ''
		);
	});

	function onInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const type = (e as InputEvent).inputType ?? '';
		text = maskDateInput(el.value, type.startsWith('delete'));
		el.value = text;
	}

	function openPicker() {
		if (picker && typeof picker.showPicker === 'function') {
			try {
				picker.value = iso;
				picker.showPicker();
				return;
			} catch {
				// not allowed or unsupported: fall through to the text field
			}
		}
		field?.focus();
	}

	function onPicked() {
		if (!picker?.value) return;
		text = toDisplayDate(picker.value);
		touched = true;
		field?.focus();
	}
</script>

<div class="relative {klass}">
	<input
		bind:this={field}
		{id}
		name={ready ? undefined : name}
		type="text"
		class="field num pr-12"
		inputmode="numeric"
		spellcheck="false"
		autocomplete="off"
		placeholder="dd/mm/yyyy"
		maxlength="10"
		{required}
		aria-invalid={error || invalid ? 'true' : undefined}
		aria-describedby="{id}-err"
		value={text}
		oninput={onInput}
		onblur={() => (touched = true)}
	/>
	{#if ready}
		<input type="hidden" {name} value={iso} />
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600"
			aria-label="Open calendar"
			onclick={openPicker}
		>
			<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
				<path
					d="M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		<input
			bind:this={picker}
			type="date"
			tabindex="-1"
			aria-hidden="true"
			class="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
			onchange={onPicked}
		/>
	{/if}
	<div id="{id}-err" aria-live="polite">
		{#if error}<p class="field-error">{error}</p>{/if}
	</div>
</div>
