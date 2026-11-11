<script lang="ts">
	import { onMount } from 'svelte';
	import { burst, stepSparks, type Spark } from '#lib/theme/season.ts';

	// All markup for both seasons is always rendered (so SSR and hydration match); CSS shows the
	// part that matches <html data-season> (set before first paint by app.html).

	// Deterministic "random" so server and client render identical particles.
	const pseudo = (i: number, salt: number) => ((i * 9301 + salt * 49297) % 233280) / 233280;
	const range = (n: number) => Array.from({ length: n }, (_, i) => i);

	const lights = range(14); // bulb indices
	const baubles = [
		{ left: 56, len: 12, delay: 0, tone: 'a' },
		{ left: 63, len: 22, delay: -1.2, tone: 'b' },
		{ left: 70, len: 14, delay: -2.4, tone: 'a' },
		{ left: 77, len: 26, delay: -0.6, tone: 'b' }
	];
	const flakes = range(26).map((i) => ({
		left: pseudo(i, 1) * 100,
		top: pseudo(i, 2) * 40,
		dur: 5 + pseudo(i, 3) * 6,
		delay: -pseudo(i, 4) * 10
	}));
	const confetti = range(24).map((i) => ({
		left: pseudo(i, 5) * 100,
		top: pseudo(i, 6) * 30,
		dur: 4 + pseudo(i, 7) * 5,
		delay: -pseudo(i, 8) * 9,
		tone: 'abc'[i % 3]
	}));
	const sparkles = range(22).map((i) => ({
		left: pseudo(i, 9) * 100,
		top: pseudo(i, 10) * 100,
		dur: 2 + pseudo(i, 11) * 3,
		delay: -pseudo(i, 12) * 5,
		tone: 'abc'[i % 3]
	}));

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const root = document.documentElement;
		let sparks: Spark[] = [];
		let raf = 0;
		let lastBurst = 0;
		let palette: string[] = [];

		const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
		const readPalette = () => {
			const style = getComputedStyle(canvas);
			palette = ['a', 'b', 'c'].map((k) => style.getPropertyValue(`--t-deco-${k}`).trim());
		};
		const shouldRun = () => root.dataset.season === 'nye' && !document.hidden && !motion.matches;

		function frame(t: number) {
			if (!shouldRun()) return stop();
			ctx!.globalCompositeOperation = 'destination-out';
			ctx!.fillStyle = 'rgb(0 0 0 / 0.16)';
			ctx!.fillRect(0, 0, canvas.width, canvas.height);
			ctx!.globalCompositeOperation = 'lighter';
			if (t - lastBurst > 1100) {
				lastBurst = t;
				sparks.push(
					...burst(
						(0.1 + Math.random() * 0.8) * canvas.width,
						(0.15 + Math.random() * 0.5) * canvas.height,
						Math.floor(Math.random() * 3),
						Math.random
					)
				);
			}
			sparks = stepSparks(sparks);
			for (const s of sparks) {
				ctx!.globalAlpha = s.life;
				ctx!.fillStyle = palette[s.color];
				ctx!.fillRect(s.x, s.y, 2.4, 2.4);
			}
			ctx!.globalAlpha = 1;
			raf = requestAnimationFrame(frame);
		}
		function stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			sparks = [];
			clear();
		}
		function sync() {
			if (!shouldRun()) return stop();
			const box = canvas.getBoundingClientRect();
			canvas.width = Math.max(Math.round(box.width), 1);
			canvas.height = Math.max(Math.round(box.height), 1);
			readPalette();
			if (!raf) raf = requestAnimationFrame(frame);
		}

		sync();
		window.addEventListener('resize', sync);
		document.addEventListener('visibilitychange', sync);
		motion.addEventListener('change', sync);
		return () => {
			window.removeEventListener('resize', sync);
			document.removeEventListener('visibilitychange', sync);
			motion.removeEventListener('change', sync);
			stop();
		};
	});
</script>

<div class="season-decor" aria-hidden="true">
	<div class="xmas">
		<div class="snow">
			{#each flakes as f, i (i)}
				<i
					style="left:{f.left}%;top:{f.top}%;animation-duration:{f.dur}s;animation-delay:{f.delay}s"
				></i>
			{/each}
		</div>
		<div class="lights">
			<div class="wire"></div>
			{#each lights as k (k)}
				<i data-tone={'abc'[k % 3]} style="left:{3 + k * 7.2}%;top:{k % 2 ? 6 : 10}px"></i>
			{/each}
		</div>
		{#each baubles as b, i (i)}
			<div
				class="orn"
				data-tone={b.tone}
				style="left:{b.left}%;--len:{b.len}px;animation-delay:{b.delay}s"
			>
				<i></i><b></b>
			</div>
		{/each}
		<svg class="trees" viewBox="0 0 170 80">
			<rect class="trunk" x="32" y="66" width="6" height="12" />
			<polygon class="tr" points="35,14 14,44 56,44" />
			<polygon class="tr2" points="35,28 8,66 62,66" />
			<polygon class="star" points="35,4 38,12 32,12" />
			<rect class="trunk" x="94" y="58" width="7" height="20" />
			<polygon class="tr" points="97,2 70,34 124,34" />
			<polygon class="tr2" points="97,18 62,56 132,56" />
			<polygon class="star" points="97,-4 101,4 93,4" />
			<rect class="trunk" x="146" y="68" width="5" height="10" />
			<polygon class="tr" points="148,24 132,48 164,48" />
			<polygon class="tr2" points="148,36 128,68 168,68" />
		</svg>
		<svg class="drift" viewBox="0 0 400 14" preserveAspectRatio="none">
			<path d="M0 14 Q40 0 80 9 T160 8 T240 9 T320 6 T400 9 V14Z" />
		</svg>
		<div class="candy"></div>
	</div>

	<div class="nye">
		<canvas bind:this={canvas}></canvas>
		<div class="sparkles">
			{#each sparkles as s, i (i)}
				<i
					data-tone={s.tone}
					style="left:{s.left}%;top:{s.top}%;animation-duration:{s.dur}s;animation-delay:{s.delay}s"
				></i>
			{/each}
			{#each confetti as c, i (i)}
				<b
					data-tone={c.tone}
					style="left:{c.left}%;top:{c.top}px;animation-duration:{c.dur}s;animation-delay:{c.delay}s"
				></b>
			{/each}
		</div>
		<div class="mark">2027</div>
		<div class="streamer"></div>
	</div>
</div>

<style>
	/*
	 * A decorative band above the header, only shown in a season. Colours come from the season
	 * tokens (--t-band, --t-deco-*, --t-on-band). The only literals are the two documented below.
	 */
	.season-decor {
		/* Snow and candy stripes are white by nature; the trunk is brown. Not themeable on purpose. */
		--snow: #fff;
		--trunk: #6b4a2f;
		--strip: 4.5rem;
		position: relative;
		display: none;
		height: var(--strip);
		overflow: hidden;
		isolation: isolate;
		pointer-events: none;
		background: var(--t-band);
		color: var(--t-on-band);
	}
	:global(:root[data-season='xmas']) .season-decor,
	:global(:root[data-season='nye']) .season-decor {
		display: block;
	}
	.xmas,
	.nye {
		position: absolute;
		inset: 0;
		display: none;
	}
	:global(:root[data-season='xmas']) .xmas,
	:global(:root[data-season='nye']) .nye {
		display: block;
	}
	[data-tone='a'] {
		--tone: var(--t-deco-a);
	}
	[data-tone='b'] {
		--tone: var(--t-deco-b);
	}
	[data-tone='c'] {
		--tone: var(--t-deco-c);
	}

	/* Christmas */
	.snow,
	.lights,
	.sparkles {
		position: absolute;
		inset: 0;
	}
	.snow i {
		position: absolute;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--snow);
		opacity: 0.55;
		animation: fall linear infinite;
	}
	.lights {
		height: 22px;
		bottom: auto;
	}
	.wire {
		position: absolute;
		left: -10px;
		right: -10px;
		top: -10px;
		height: 22px;
		border-bottom: 2px solid color-mix(in srgb, var(--t-on-band) 25%, transparent);
		border-radius: 50%;
	}
	.lights i {
		position: absolute;
		width: 9px;
		height: 13px;
		border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
		background: var(--tone);
		color: var(--tone);
		box-shadow: 0 0 10px 2px currentColor;
	}
	.orn {
		position: absolute;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform-origin: top center;
		animation: sway 4s ease-in-out infinite;
	}
	.orn i {
		width: 1px;
		height: var(--len);
		background: color-mix(in srgb, var(--t-on-band) 45%, transparent);
	}
	.orn b {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background:
			radial-gradient(
				circle at 35% 30%,
				color-mix(in srgb, var(--snow) 60%, transparent) 0 12%,
				transparent 14%
			),
			var(--tone);
		box-shadow: 0 2px 6px color-mix(in srgb, black 30%, transparent);
	}
	.trees {
		position: absolute;
		right: 18px;
		bottom: 6px;
		width: 120px;
		height: auto;
	}
	.tr {
		fill: color-mix(in srgb, var(--t-deco-c) 70%, black);
	}
	.tr2 {
		fill: color-mix(in srgb, var(--t-deco-c) 85%, black);
	}
	.trunk {
		fill: var(--trunk);
	}
	.star {
		fill: var(--t-deco-b);
	}
	.drift {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 6px;
		width: 100%;
		height: 14px;
	}
	.drift path {
		fill: var(--snow);
		opacity: 0.92;
	}
	.candy {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 6px;
		background: repeating-linear-gradient(135deg, var(--t-deco-a) 0 8px, var(--snow) 8px 16px);
	}

	/* New Year */
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.sparkles i {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 1px;
		background: var(--tone);
		animation: twinkle ease-in-out infinite;
	}
	.sparkles b {
		position: absolute;
		width: 5px;
		height: 9px;
		border-radius: 1px;
		background: var(--tone);
		animation: confetti linear infinite;
	}
	.mark {
		position: absolute;
		right: 22px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 3.5rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		line-height: 1;
		color: transparent;
		-webkit-text-stroke: 1px color-mix(in srgb, var(--t-deco-a) 60%, transparent);
	}
	.streamer {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 4px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--t-deco-a),
			var(--t-deco-c),
			var(--t-deco-a),
			transparent
		);
	}

	@keyframes fall {
		from {
			transform: translateY(-10px);
		}
		to {
			transform: translateY(var(--strip));
		}
	}
	@keyframes sway {
		0%,
		100% {
			transform: rotate(-5deg);
		}
		50% {
			transform: rotate(5deg);
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.15;
			transform: scale(0.6) rotate(0);
		}
		50% {
			opacity: 0.95;
			transform: scale(1.1) rotate(45deg);
		}
	}
	@keyframes confetti {
		from {
			transform: translateY(-14px) rotate(0);
		}
		to {
			transform: translateY(var(--strip)) rotate(540deg);
		}
	}

	@media (max-width: 640px) {
		.trees,
		.mark {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.season-decor :is(*, *::before, *::after) {
			animation: none;
		}
	}
</style>
