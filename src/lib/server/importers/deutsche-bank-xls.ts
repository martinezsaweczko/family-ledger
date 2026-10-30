import * as XLSX from 'xlsx';
import type { Importer, ParsedRow, ParsedStatement } from './types.ts';

const SHEET = 'Movimientos';
// Column indexes (0-based) in the "Movimientos" sheet.
const COL = { date: 1, valueDate: 2, concept: 3, amount: 8, balance: 9 } as const;

type Cell = string | number | null | undefined;

function readRows(buf: Buffer): unknown[][] {
	const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
	const ws = wb.Sheets[SHEET];
	if (!ws) throw new Error(`Sheet "${SHEET}" not found`);
	return XLSX.utils.sheet_to_json<unknown[]>(ws, {
		header: 1,
		raw: true,
		defval: null,
		blankrows: true
	});
}

const findHeaderRow = (rows: unknown[][]) =>
	rows.findIndex((r) => r[COL.date] === 'date' && r[COL.amount] === 'amount');

function toIsoDate(value: Cell): string {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? '').trim());
	if (!m) throw new Error(`Unexpected date format: ${JSON.stringify(value)}`);
	return `${m[3]}-${m[2]}-${m[1]}`;
}

function toCents(value: Cell, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Expected a numeric ${label}, got ${JSON.stringify(value)}`);
	}
	return Math.round(value * 100);
}

export const deutscheBankXls: Importer = {
	id: 'deutsche-bank-xls',
	label: 'Deutsche Bank (Spain) .xls',
	accepts: ['.xls'],

	detect(buf, filename) {
		if (!filename.toLowerCase().endsWith('.xls')) return false;
		try {
			const rows = readRows(buf);
			return findHeaderRow(rows) >= 0 && rows.some((r) => r[1] === 'Cuenta:');
		} catch {
			return false;
		}
	},

	parse(buf): ParsedStatement {
		const all = readRows(buf);
		const headerIdx = findHeaderRow(all);
		if (headerIdx < 0)
			throw new Error('Table header (date, value_date, concept, amount) not found');
		const info = all.find((r) => r[1] === 'Cuenta:');
		const iban = String(info?.[2] ?? '').replace(/\s+/g, '');
		if (!iban) throw new Error('Account IBAN ("Cuenta:") not found');
		const currency = String(info?.[8] ?? 'EUR').trim() || 'EUR';

		const rows: ParsedRow[] = [];
		for (const r of all.slice(headerIdx + 1)) {
			if (r[COL.date] == null && r[COL.amount] == null) continue; // trailing/blank rows
			const concept = String(r[COL.concept] ?? '');
			const balance = r[COL.balance];
			rows.push({
				bookingDate: toIsoDate(r[COL.date] as Cell),
				valueDate: toIsoDate(r[COL.valueDate] as Cell),
				concept,
				amountCents: toCents(r[COL.amount] as Cell, 'amount'),
				balanceCents: balance == null ? null : toCents(balance as Cell, 'balance'),
				raw: {
					date: r[COL.date],
					value_date: r[COL.valueDate],
					concept,
					amount: r[COL.amount],
					balance: balance ?? null
				}
			});
		}
		return { account: { iban, currency }, rows };
	}
};
