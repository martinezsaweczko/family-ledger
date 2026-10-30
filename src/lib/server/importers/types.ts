export interface ParsedRow {
	/** ISO date YYYY-MM-DD */
	bookingDate: string;
	/** ISO date YYYY-MM-DD */
	valueDate: string;
	/** Original concept text (internal whitespace preserved). */
	concept: string;
	/** Signed integer cents: negative = money out. */
	amountCents: number;
	/** Balance after the movement in integer cents, when the bank provides it. */
	balanceCents: number | null;
	/** Original source payload, stored verbatim in statements.raw_json. */
	raw: Record<string, unknown>;
}

export interface ParsedStatement {
	account: { iban: string; currency: string };
	rows: ParsedRow[];
}

export interface Importer {
	id: string;
	label: string;
	/** Accepted file extensions, lowercase with the dot, e.g. ['.xls']. */
	accepts: string[];
	detect(buf: Buffer, filename: string): boolean;
	parse(buf: Buffer): ParsedStatement;
}
