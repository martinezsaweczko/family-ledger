/**
 * Intl output uses a no-break space (U+00A0) or a narrow one (U+202F) between a number and its
 * unit. Tests and screenshots compare against plain spaces; use this instead of loosening a
 * matcher.
 */
export function normalizeSpaces(text: string): string {
	return text.replace(/[\u00a0\u202f]/g, ' ');
}
