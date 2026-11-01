/** Small colour maths: WCAG contrast and OKLCH-based lifting of category colours for the dark theme. */
export type Scheme = 'light' | 'dark';

/** The card surface charts are drawn on, per scheme (kept equal to --t-card; tokens.spec.ts guards the CSS side). */
export const CARD: Record<Scheme, string> = { light: '#ffffff', dark: '#111a2b' };

/**
 * Dark mode lightness map: L' = DARK_BASE_L + DARK_SPREAD_L * L (mirrors `.cat-dot` in layout.css).
 * The floor (L = 0 -> 0.58) already clears 3:1 on the dark card, and the slope keeps part of the
 * original lightness differences so neighbouring categories stay distinguishable.
 */
export const DARK_BASE_L = 0.58;
export const DARK_SPREAD_L = 0.35;
/** Minimum contrast of a data mark against the card (WCAG 1.4.11). */
export const MIN_GRAPHIC_CONTRAST = 3;

type Rgb = [number, number, number];

function parse(hex: string): Rgb | null {
	const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	let h = m[1];
	if (h.length === 3) h = [...h].map((c) => c + c).join('');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export function hexToRgb(hex: string): Rgb {
	const rgb = parse(hex);
	if (!rgb) throw new Error(`not a hex colour: ${hex}`);
	return rgb;
}

const toHex = (rgb: Rgb) =>
	'#' +
	rgb
		.map((v) =>
			Math.round(Math.min(255, Math.max(0, v)))
				.toString(16)
				.padStart(2, '0')
		)
		.join('');

const lin = (c: number) => {
	const v = c / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const delin = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex).map(lin);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

function toOklab(hex: string): [number, number, number] {
	const [r, g, b] = hexToRgb(hex).map(lin);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	];
}

/** Linear sRGB of an OKLab colour (unclamped, so gamut membership can be tested). */
function fromOklabLinear(L: number, a: number, b: number): Rgb {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH -> hex, reducing chroma (keeping L and hue) until the colour fits sRGB. */
function fromOklch(L: number, C: number, h: number): string {
	let lo = 0;
	let hi = C;
	const at = (c: number) => fromOklabLinear(L, c * Math.cos(h), c * Math.sin(h));
	if (!inGamut(at(hi))) {
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2;
			if (inGamut(at(mid))) lo = mid;
			else hi = mid;
		}
		hi = lo;
	}
	return toHex(at(hi).map(delin) as Rgb);
}

/** Euclidean distance in OKLab; ~0.02 is a just-noticeable difference, >0.05 reads as a different colour. */
export function oklabDistance(a: string, b: string): number {
	const [l1, a1, b1] = toOklab(a);
	const [l2, a2, b2] = toOklab(b);
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Category colours are stored for a light background. Returns the colour to draw on the card of the
 * given scheme: same hue, lightness lifted (dark) or lowered (light) just enough to reach 3:1.
 * Deterministic; values that are not hex pass through unchanged.
 */
export function chartColor(color: string, scheme: Scheme, card: string = CARD[scheme]): string {
	if (!parse(color)) return color;
	const hex = toHex(hexToRgb(color));
	const [L, a, b] = toOklab(hex);
	const C = Math.hypot(a, b);
	const h = Math.atan2(b, a);
	if (scheme === 'dark') {
		return fromOklch(DARK_BASE_L + DARK_SPREAD_L * L, C, h);
	}
	if (contrast(hex, card) >= MIN_GRAPHIC_CONTRAST) return hex;
	for (let l = L - 0.01; l > 0.2; l -= 0.01) {
		const out = fromOklch(l, C, h);
		if (contrast(out, card) >= MIN_GRAPHIC_CONTRAST) return out;
	}
	return fromOklch(0.2, C, h);
}
