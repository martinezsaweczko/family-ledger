const MAX_LENGTH = 60;
const PREFIXES = /^(TARJETA|RECIBO|COMPRA|ADEUDO|PAGO)[-\s]+/;

/**
 * Reduces a bank concept to a stable merchant name, used for rule suggestions,
 * top-merchant ranking and recurring-expense detection.
 *
 * Strips channel prefixes (`TARJETA-`, `RECIBO `, ...), POS/store numbers at the
 * start, payment-processor references (`AIRBNB * XYZ123`, `REVOLUT**8864*`) and
 * trailing reference numbers or years. Result is upper-case with single spaces.
 */
export function cleanMerchant(concept: string): string {
	let text = concept.replace(/\s+/g, ' ').trim().toUpperCase();
	if (!text) return '';
	const original = text;
	// Prefixes can stack ("RECIBO COMPRA ...") so strip repeatedly.
	for (let prev = ''; prev !== text;) {
		prev = text;
		text = text.replace(PREFIXES, '');
	}
	text = text
		.replace(/\s+\*.*$/, '') // "AIRBNB * HMFNFSPJQK"
		.replace(/\*+\d+\*?$/, '') // "REVOLUT**8864*"
		.replace(/^\d{3,6}\s+/, ''); // store number: "5895 CAPRABO"
	// Trailing numeric references, with punctuation left behind.
	for (let prev = ''; prev !== text;) {
		prev = text;
		text = text
			.replace(/[\s,;./-]*\s[\d.,/-]*\d[\d.,/-]*[\s,;.\-/]*$/, '')
			.replace(/[\s,;.-]+$/, '');
	}
	text = text.trim();
	if (!text) text = original.replace(PREFIXES, '').trim() || original;
	return text.slice(0, MAX_LENGTH).trim();
}
