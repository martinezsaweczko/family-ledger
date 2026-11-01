/** European number formats (es-ES base, English UI). Grouping is forced so 4-digit values group too. */
const LOCALE = 'es-ES';

export function formatInteger(value: number): string {
	return new Intl.NumberFormat(LOCALE, { useGrouping: 'always', maximumFractionDigits: 0 }).format(
		value
	);
}

export function formatDecimal(value: number, digits = 2): string {
	return new Intl.NumberFormat(LOCALE, {
		useGrouping: 'always',
		minimumFractionDigits: 0,
		maximumFractionDigits: digits
	}).format(value);
}

/** `fraction` is 0.125 for 12,5 %. `signed` prefixes + for positive values (deltas). */
export function formatPercent(fraction: number, digits = 0, signed = false): string {
	return new Intl.NumberFormat(LOCALE, {
		style: 'percent',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
		signDisplay: signed ? 'exceptZero' : 'auto'
	}).format(fraction);
}
