<script lang="ts">
	/*
	 * Endless drifting backdrop: a hand-drawn tile (rooftops, savings bars, coins, leaf sprigs) in flat
	 * token fills. The tile is drawn once in <defs> and placed twice, one above the other; the track
	 * translates by exactly one tile height, so the loop has no seam. Transform only, no gradients,
	 * decorative (aria-hidden), and static under prefers-reduced-motion.
	 *
	 * Colours are the --color-* tokens (light and dark follow the theme). Text must never sit directly
	 * on it: content lives on flat bg-card / bg-band surfaces.
	 */
	const TILE_W = 1200;
	const TILE_H = 960;
	const bars = (xs: number, base: number, heights: number[], a: string, b: string) =>
		heights.map((h, i) => ({
			x: xs + i * 60,
			y: base - h,
			h,
			fill: i % 2 === 0 ? a : b
		}));

	// [x, baseline, heights, tone A, tone B]
	const barSets = [
		bars(40, 260, [90, 150, 120, 210, 170], 'var(--color-primary-100)', 'var(--color-primary-50)'),
		bars(
			760,
			560,
			[60, 110, 170, 140, 230, 190],
			'var(--color-highlight-100)',
			'var(--color-primary-100)'
		)
	];
</script>

<div class="backdrop" aria-hidden="true" data-testid="scroll-backdrop">
	<svg class="defs" width="0" height="0" focusable="false">
		<defs>
			<!-- house, origin bottom-left, 120 wide -->
			<g id="bd-house">
				<rect x="0" y="-90" width="120" height="90" style="fill: var(--a)" />
				<polygon points="-12,-90 60,-150 132,-90" style="fill: var(--b)" />
				<rect x="48" y="-48" width="24" height="48" style="fill: var(--b)" />
			</g>
			<!-- coin, origin centre -->
			<g id="bd-coin">
				<circle r="48" style="fill: var(--a)" />
				<circle r="32" style="fill: var(--b)" />
				<rect x="-6" y="-18" width="12" height="36" rx="3" style="fill: var(--a)" />
			</g>
			<!-- leaf, origin at its stem -->
			<path
				id="bd-leaf"
				d="M0 0 C 40 -62 120 -62 150 0 C 120 62 40 62 0 0 Z"
				style="fill: var(--a)"
			/>
			<g id="bd-tile">
				{#each barSets as set, s (s)}
					{#each set as b (b.x)}
						<rect x={b.x} y={b.y} width="44" height={b.h} rx="4" style="fill: {b.fill}" />
					{/each}
				{/each}

				<!-- row 1 -->
				<use
					href="#bd-house"
					transform="translate(420 260)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(610 260) scale(.8)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-100)"
				/>
				<use
					href="#bd-coin"
					transform="translate(900 170)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-coin"
					transform="translate(1030 215) scale(.7)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100)"
				/>

				<!-- row 2 -->
				<use
					href="#bd-house"
					transform="translate(60 560) scale(1.2)"
					style="--a: var(--color-highlight-100); --b: var(--color-primary-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(300 560)"
					style="--a: var(--color-primary-50); --b: var(--color-attention-100)"
				/>
				<use
					href="#bd-leaf"
					transform="translate(500 470) rotate(-30)"
					style="--a: var(--color-primary-100)"
				/>
				<use
					href="#bd-leaf"
					transform="translate(500 470) rotate(-80) scale(.8)"
					style="--a: var(--color-primary-50)"
				/>
				<use
					href="#bd-coin"
					transform="translate(1110 440)"
					style="--a: var(--color-primary-100); --b: var(--color-attention-100)"
				/>

				<!-- row 3 -->
				<use
					href="#bd-coin"
					transform="translate(110 800)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-coin"
					transform="translate(110 845) scale(.9)"
					style="--a: var(--color-attention-100); --b: var(--color-highlight-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(330 880)"
					style="--a: var(--color-primary-100); --b: var(--color-attention-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(520 880) scale(1.3)"
					style="--a: var(--color-highlight-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-house"
					transform="translate(760 880) scale(.9)"
					style="--a: var(--color-primary-50); --b: var(--color-primary-100)"
				/>
				<use
					href="#bd-leaf"
					transform="translate(1000 830) rotate(-40)"
					style="--a: var(--color-primary-100)"
				/>
				<use
					href="#bd-leaf"
					transform="translate(1000 830) rotate(-95) scale(.75)"
					style="--a: var(--color-highlight-100)"
				/>
			</g>
		</defs>
	</svg>

	<div class="track">
		<svg viewBox="0 0 {TILE_W} {TILE_H}" preserveAspectRatio="xMidYMin slice" focusable="false">
			<use href="#bd-tile" />
		</svg>
		<svg viewBox="0 0 {TILE_W} {TILE_H}" preserveAspectRatio="xMidYMin slice" focusable="false">
			<use href="#bd-tile" />
		</svg>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
		background: var(--color-paper);
	}
	.defs {
		position: absolute;
	}
	.track {
		/* Never narrower than the tile's natural proportions, so shapes stay recognisable. */
		width: max(100%, 900px);
		margin-inline: auto;
		animation: backdrop-drift 120s linear infinite;
		will-change: transform;
	}
	.track svg {
		display: block;
		width: 100%;
		height: auto;
	}
	@keyframes backdrop-drift {
		from {
			transform: translateY(0);
		}
		to {
			/* The track holds two stacked tiles: -50% is exactly one tile. */
			transform: translateY(-50%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.track {
			animation: none;
			will-change: auto;
		}
	}
</style>
