<script lang="ts">
	import { formatMoney } from '#lib/format/money.ts';

	interface Month {
		label: string;
		incomeCents: number;
		expenseCents: number;
	}
	interface Props {
		months: Month[];
		label: string;
	}
	let { months, label }: Props = $props();

	const W = 360;
	const H = 132;
	const top = 8;
	const bottom = 22;
	const max = $derived(Math.max(1, ...months.flatMap((m) => [m.incomeCents, m.expenseCents])));
	const slot = $derived(W / Math.max(1, months.length));
	const bar = $derived(Math.min(14, slot * 0.32));
	const y = (c: number) => ((H - top - bottom) * c) / max;
	// Label every second month on dense charts so the axis never crowds.
	const step = $derived(months.length > 8 ? 2 : 1);
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={label} class="block w-full">
	<line x1="0" x2={W} y1={H - bottom} y2={H - bottom} class="stroke-line" />
	{#each months as m, i (i)}
		{@const cx = slot * i + slot / 2}
		<g>
			<title
				>{m.label}: income {formatMoney(m.incomeCents)}, expenses {formatMoney(
					m.expenseCents
				)}</title
			>
			<rect
				x={cx - bar - 1}
				y={H - bottom - y(m.incomeCents)}
				width={bar}
				height={y(m.incomeCents)}
				rx="2"
				class="fill-primary-500"
			/>
			<rect
				x={cx + 1}
				y={H - bottom - y(m.expenseCents)}
				width={bar}
				height={y(m.expenseCents)}
				rx="2"
				class="fill-attention-500"
			/>
			{#if i % step === 0}
				<text x={cx} y={H - 6} text-anchor="middle" class="fill-ink-soft text-[10px]"
					>{m.label}</text
				>
			{/if}
		</g>
	{/each}
</svg>
