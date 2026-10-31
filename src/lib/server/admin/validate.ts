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

/**
 * Parses a user-typed money amount ("40", "40.5", "40,50", "1.234,56" is NOT supported) into
 * positive integer cents; null when it is not a positive amount with at most 2 decimals.
 */
export function parseCents(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim());
	if (!m) return null;
	const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
	return cents > 0 ? cents : null;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
