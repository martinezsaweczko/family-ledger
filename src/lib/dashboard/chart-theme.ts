import type { Scheme } from '#lib/theme/color.ts';

/** Chart colours come from the Clear Slate tokens in layout.css (read at runtime, never hardcoded). */
export interface ChartTheme {
	ink: string;
	inkSoft: string;
	line: string;
	card: string;
	primary: string;
	primaryLight: string;
	highlight: string;
	attention: string;
	/** Neutral series colour ("Other", unattributed). */
	slate: string;
	/** Axis-pointer / hover wash. */
	pointer: string;
	shadow: string;
	scheme: Scheme;
	font: string;
	animate: boolean;
}

const FALLBACK: ChartTheme = {
	ink: '#0f1b2a',
	inkSoft: '#566577',
	line: '#dde3ea',
	card: '#ffffff',
	primary: '#0f9488',
	primaryLight: '#c2ebe6',
	highlight: '#4f5bd5',
	attention: '#e08a00',
	slate: '#64748b',
	pointer: 'rgb(15 27 42 / 0.05)',
	shadow: '0 1px 2px rgb(15 27 42 / 0.12)',
	scheme: 'light',
	font: 'Inter Variable, system-ui, sans-serif',
	animate: true
};

export function readTheme(): ChartTheme {
	if (typeof document === 'undefined') return FALLBACK;
	const css = getComputedStyle(document.documentElement);
	const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
	return {
		ink: v('--color-ink', FALLBACK.ink),
		inkSoft: v('--color-ink-soft', FALLBACK.inkSoft),
		line: v('--color-line', FALLBACK.line),
		card: v('--color-card', FALLBACK.card),
		primary: v('--color-primary-500', FALLBACK.primary),
		primaryLight: v('--color-primary-100', FALLBACK.primaryLight),
		highlight: v('--color-highlight-500', FALLBACK.highlight),
		attention: v('--color-attention-500', FALLBACK.attention),
		slate: v('--color-slate-chart', FALLBACK.slate),
		pointer: v('--t-pointer', FALLBACK.pointer),
		shadow: v('--t-shadow-pop', FALLBACK.shadow),
		scheme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
		font: v('--font-sans', FALLBACK.font),
		animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
	};
}
