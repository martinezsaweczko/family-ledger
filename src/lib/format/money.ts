import { formatDecimal } from './number.ts';

/** `1.234,56 €`: dot thousands, comma decimal, symbol after. Grouping is forced for 4-digit amounts. */
export function formatMoney(cents: number, currency = 'EUR', locale = 'es-ES'): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		useGrouping: 'always'
	}).format(cents / 100);
}

/** Short axis label: `340 €`, `1,2k €`, `2M €`. */
export function formatMoneyCompact(cents: number): string {
	const v = Math.abs(cents / 100);
	const sign = cents < 0 ? '-' : '';
	if (v >= 1_000_000) return `${sign}${formatDecimal(v / 1_000_000, 1)}M\u00a0€`;
	if (v >= 1000) return `${sign}${formatDecimal(v / 1000, 1)}k\u00a0€`;
	return `${sign}${formatDecimal(Math.round(v), 0)}\u00a0€`;
}

/** Editable amount: decimal comma, no grouping (`1234,56`). `parseMoney` reads it back. */
export function formatMoneyInput(cents: number): string {
	const abs = Math.abs(cents);
	const frac = String(abs % 100).padStart(2, '0');
	return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${frac}`;
}

const DOT_THOUSANDS = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const COMMA_THOUSANDS = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/;
const SIMPLE = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Tolerant amount parser for typed text: `40`, `40,50`, `40.5`, `1.234,56`, `1,234.56`,
 * optional spaces and a euro sign. Returns integer cents or null for anything ambiguous or
 * malformed (`1,234` alone, `40,555`, `1..234`). Non-negative unless `allowNegative`.
 */
export function parseMoney(
	value: unknown,
	options: { allowNegative?: boolean } = {}
): number | null {
	if (typeof value !== 'string') return null;
	let s = value.replace(/[\u00a0\u202f€]/g, '').trim();
	if (/\s/.test(s) && !/^-\s*\d/.test(s)) return null;
	s = s.replace(/\s+/g, '');
	let negative = false;
	if (s.startsWith('-')) {
		if (!options.allowNegative) return null;
		negative = true;
		s = s.slice(1);
	}
	let whole: string;
	let frac: string;
	let m: RegExpExecArray | null;
	if ((m = DOT_THOUSANDS.exec(s))) {
		if (m[1].startsWith('0')) return null;
		whole = m[1].replaceAll('.', '');
		frac = m[2] ?? '';
	} else if ((m = COMMA_THOUSANDS.exec(s))) {
		whole = m[1].replaceAll(',', '');
		frac = m[2];
	} else if ((m = SIMPLE.exec(s))) {
		whole = m[1];
		frac = m[2] ?? '';
	} else return null;
	if (whole.length > 9) return null;
	const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
	return negative ? -cents : cents;
}
