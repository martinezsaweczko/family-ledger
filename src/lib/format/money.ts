export function formatMoney(cents: number, currency = 'EUR', locale = 'en-GB'): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
