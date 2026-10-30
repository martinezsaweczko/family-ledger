export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const fail = (
	errors: Record<string, string>
): { ok: false; errors: Record<string, string> } => ({
	ok: false,
	errors
});

/** Parses a non-negative-or-negative integer from form text; null when not an integer. */
export function parseInteger(value: unknown): number | null {
	if (typeof value === 'number') return Number.isInteger(value) ? value : null;
	if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return null;
	return Number(value.trim());
}

/** Accepts #RGB or #RRGGBB (any case) and returns upper-case #RRGGBB. */
export function normalizeHex(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const v = value.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
	if (/^#[0-9a-fA-F]{3}$/.test(v)) {
		return `#${[...v.slice(1)].map((c) => c + c).join('')}`.toUpperCase();
	}
	return null;
}

export function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Pulls a plain string map out of FormData for the validators above. */
export function formToObject(form: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
	return out;
}

/** Drizzle wraps driver errors: the MySQL code lives on the error or its cause. */
export function isDuplicateEntry(err: unknown): boolean {
	const code = (e: unknown) => (e as { code?: string } | undefined)?.code;
	return (
		code(err) === 'ER_DUP_ENTRY' || code((err as { cause?: unknown })?.cause) === 'ER_DUP_ENTRY'
	);
}
