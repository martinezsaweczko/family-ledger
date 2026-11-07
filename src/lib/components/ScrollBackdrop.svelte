<script lang="ts">
	/*
	 * Endless drifting backdrop: one deliberately composed tile, flat token fills, no gradients or lines.
	 * Left margin: pines and a coin stack. Right margin: a home, savings bars and a tower. Across the
	 * middle: the family's street (a skyline on a ground strip), a big coin, and a staircase of savings
	 * bars with a sprout. Nothing crosses the tile's top or bottom edge, so the two stacked copies
	 * (translateY 0 -> -50%) loop without a seam. Transform only, decorative (aria-hidden), static
	 * under prefers-reduced-motion.
	 *
	 * Colours are the --color-* tokens (light and dark follow the theme). Text must never sit directly
	 * on it: content lives on flat bg-card / bg-band surfaces.
	 */
	const TILE_W = 1200;
	const TILE_H = 1000;
</script>

<div class="backdrop" aria-hidden="true" data-testid="scroll-backdrop">
	<svg class="defs" width="0" height="0" focusable="false">
		<defs>
			<!-- house, origin bottom-centre: --a walls, --b roof and trim, --c shaded side -->
			<g id="bd-house">
				<rect x="-60" y="-100" width="120" height="100" rx="4" style="fill: var(--a)" />
				<rect x="0" y="-100" width="60" height="100" style="fill: var(--c)" />
				<polygon points="-76,-98 0,-166 76,-98" style="fill: var(--b)" />
				<rect x="34" y="-158" width="16" height="42" style="fill: var(--b)" />
				<rect x="-14" y="-56" width="28" height="56" rx="3" style="fill: var(--b)" />
				<rect x="-48" y="-84" width="22" height="22" rx="3" style="fill: var(--b)" />
				<rect x="26" y="-84" width="22" height="22" rx="3" style="fill: var(--b)" />
			</g>
			<!-- tower, origin bottom-centre -->
			<g id="bd-tower">
				<rect x="-44" y="-230" width="88" height="230" rx="4" style="fill: var(--a)" />
				<rect x="6" y="-230" width="38" height="230" style="fill: var(--c)" />
				<rect x="-30" y="-250" width="60" height="22" rx="4" style="fill: var(--b)" />
				<rect x="-30" y="-200" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="-30" y="-160" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="-30" y="-120" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="-30" y="-80" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="14" y="-200" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="14" y="-160" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="14" y="-120" width="18" height="18" rx="3" style="fill: var(--b)" />
				<rect x="-12" y="-44" width="24" height="44" rx="3" style="fill: var(--b)" />
			</g>
			<!-- pine, origin at the foot of the trunk -->
			<g id="bd-tree">
				<rect x="-7" y="-44" width="14" height="44" rx="3" style="fill: var(--c)" />
				<polygon points="-58,-32 0,-120 58,-32" style="fill: var(--a)" />
				<polygon points="-48,-88 0,-166 48,-88" style="fill: var(--b)" />
				<polygon points="-36,-136 0,-206 36,-136" style="fill: var(--a)" />
			</g>
			<!-- coin stack (side view), origin bottom-centre -->
			<g id="bd-stack">
				<rect x="-46" y="-26" width="92" height="26" rx="13" style="fill: var(--a)" />
				<rect x="-46" y="-56" width="92" height="26" rx="13" style="fill: var(--b)" />
				<rect x="-46" y="-86" width="92" height="26" rx="13" style="fill: var(--a)" />
				<rect x="-46" y="-116" width="92" height="26" rx="13" style="fill: var(--b)" />
			</g>
			<!-- four rising bars, origin bottom-left -->
			<g id="bd-bars">
				<rect x="0" y="-70" width="24" height="70" rx="5" style="fill: var(--a)" />
				<rect x="32" y="-110" width="24" height="110" rx="5" style="fill: var(--b)" />
				<rect x="64" y="-160" width="24" height="160" rx="5" style="fill: var(--a)" />
				<rect x="96" y="-210" width="24" height="210" rx="5" style="fill: var(--b)" />
			</g>
			<!-- coin, origin centre -->
			<g id="bd-coin">
				<circle r="48" style="fill: var(--a)" />
				<circle r="33" style="fill: var(--b)" />
				<rect x="-6" y="-18" width="12" height="36" rx="4" style="fill: var(--a)" />
			</g>
			<!-- sprig: a stem with three leaves, origin at the foot -->
			<g id="bd-sprig">
				<rect x="-3" y="-90" width="6" height="90" rx="3" style="fill: var(--a)" />
				<path
					d="M0 -40 C -10 -64 -42 -70 -58 -62 C -52 -38 -26 -30 0 -40 Z"
					style="fill: var(--b)"
				/>
				<path d="M0 -58 C 10 -82 42 -88 58 -80 C 52 -56 26 -48 0 -58 Z" style="fill: var(--a)" />
				<path
					d="M0 -90 C -12 -112 -8 -134 0 -146 C 8 -134 12 -112 0 -90 Z"
					style="fill: var(--b)"
				/>
			</g>
			<g id="bd-tile">
				<!-- left margin: pines and a coin stack -->
				<use
					href="#bd-tree"
					transform="translate(76 250) scale(1.15)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50); --c: var(--color-highlight-100)"
				/>
				<use
					href="#bd-stack"
					transform="translate(76 590) scale(0.95)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-100)"
				/>
				<use
					href="#bd-tree"
					transform="translate(76 930) scale(0.85)"
					style="--a: var(--color-primary-50); --b: var(--color-primary-100); --c: var(--color-primary-100)"
				/>
				<!-- right margin: a home, savings bars, a tower -->
				<use
					href="#bd-house"
					transform="translate(1126 330) scale(0.85)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100); --c: var(--color-primary-50)"
				/>
				<use
					href="#bd-bars"
					transform="translate(1066 720)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-tower"
					transform="translate(1130 985) scale(0.8)"
					style="--a: var(--color-highlight-100); --b: var(--color-primary-100); --c: var(--color-primary-50)"
				/>
				<!-- skyline of the family's street, on a ground strip -->
				<rect
					x="190"
					y="500"
					width="820"
					height="26"
					rx="13"
					style="fill: var(--color-primary-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(250 500)"
					style="--a: var(--color-primary-50); --b: var(--color-attention-100); --c: var(--color-primary-100)"
				/>
				<use
					href="#bd-tower"
					transform="translate(380 500)"
					style="--a: var(--color-highlight-100); --b: var(--color-primary-100); --c: var(--color-primary-50)"
				/>
				<use
					href="#bd-house"
					transform="translate(520 500) scale(1.2)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100); --c: var(--color-primary-50)"
				/>
				<use
					href="#bd-tower"
					transform="translate(680 500) scale(1.15)"
					style="--a: var(--color-primary-50); --b: var(--color-primary-100); --c: var(--color-highlight-100)"
				/>
				<use
					href="#bd-house"
					transform="translate(830 500)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-100); --c: var(--color-primary-50)"
				/>
				<use
					href="#bd-tower"
					transform="translate(950 500) scale(0.85)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50); --c: var(--color-highlight-100)"
				/>
				<use
					href="#bd-sprig"
					transform="translate(200 500)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50)"
				/>
				<!-- big coin and a sprig, upper middle -->
				<use
					href="#bd-coin"
					transform="translate(640 120) scale(1.7)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-coin"
					transform="translate(350 110) scale(0.8)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100)"
				/>
				<use
					href="#bd-sprig"
					transform="translate(900 250) scale(1.1)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50)"
				/>
				<!-- savings staircase with a sprout, lower middle -->
				<rect
					x="300"
					y="910"
					width="46"
					height="50"
					rx="6"
					style="fill: var(--color-primary-100)"
				/>
				<rect x="362" y="870" width="46" height="90" rx="6" style="fill: var(--color-primary-50)" />
				<rect
					x="424"
					y="830"
					width="46"
					height="130"
					rx="6"
					style="fill: var(--color-primary-100)"
				/>
				<rect
					x="486"
					y="785"
					width="46"
					height="175"
					rx="6"
					style="fill: var(--color-primary-50)"
				/>
				<rect
					x="548"
					y="735"
					width="46"
					height="225"
					rx="6"
					style="fill: var(--color-primary-100)"
				/>
				<rect
					x="610"
					y="680"
					width="46"
					height="280"
					rx="6"
					style="fill: var(--color-primary-50)"
				/>
				<use
					href="#bd-sprig"
					transform="translate(633 680) scale(0.8)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100)"
				/>
				<use
					href="#bd-coin"
					transform="translate(770 880) scale(0.9)"
					style="--a: var(--color-attention-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-coin"
					transform="translate(850 925) scale(0.6)"
					style="--a: var(--color-primary-100); --b: var(--color-highlight-100)"
				/>
				<use
					href="#bd-coin"
					transform="translate(200 760) scale(1.1)"
					style="--a: var(--color-highlight-100); --b: var(--color-primary-50)"
				/>
				<use
					href="#bd-stack"
					transform="translate(509 785) scale(0.7)"
					style="--a: var(--color-primary-100); --b: var(--color-primary-50)"
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
		width: max(100%, 960px);
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
