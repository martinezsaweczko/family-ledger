/** Theme preference: stored value + system preference -> effective theme, and the DOM side effects. */
export type ThemePref = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_KEY = 'hearth-theme';
export const PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

/** Must equal --t-paper of each scheme in layout.css (tokens.spec.ts checks app.html against it). */
export const THEME_COLOR: Record<EffectiveTheme, string> = { light: '#f6f8fa', dark: '#0b1220' };

export function parsePref(raw: string | null | undefined): ThemePref {
	return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): EffectiveTheme {
	if (pref === 'system') return systemDark ? 'dark' : 'light';
	return pref;
}

export function nextPref(pref: ThemePref, step: 1 | -1): ThemePref {
	return PREFS[(PREFS.indexOf(pref) + step + PREFS.length) % PREFS.length];
}

export function readStoredPref(): ThemePref {
	try {
		return parsePref(localStorage.getItem(THEME_KEY));
	} catch {
		return 'system';
	}
}

export function storePref(pref: ThemePref): void {
	try {
		if (pref === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, pref);
	} catch {
		// private mode / blocked storage: the choice just lasts for this page view
	}
}

export const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Writes data-theme (effective), data-theme-pref and the theme-color metas. `fade` adds a short colour transition. */
export function applyTheme(pref: ThemePref, fade = false): EffectiveTheme {
	const root = document.documentElement;
	const effective = resolveTheme(pref, systemDark());
	if (fade) {
		root.classList.add('theme-fade');
		setTimeout(() => root.classList.remove('theme-fade'), 250);
	}
	root.dataset.themePref = pref;
	root.dataset.theme = effective;
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const own = meta.dataset.scheme as EffectiveTheme | undefined;
		meta.content = THEME_COLOR[pref === 'system' && own ? own : effective];
	}
	return effective;
}
