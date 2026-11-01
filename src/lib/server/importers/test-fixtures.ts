import * as XLSX from 'xlsx';

export const FAKE_IBAN = 'ES0000000000000000000000';

export interface FakeRow {
	date: string;
	valueDate: string;
	concept: string;
	amount: number;
	balance: number;
}

/** Builds a synthetic .xls mimicking the Deutsche Bank "Movimientos" layout (fake data only). */
export function buildDbXls(rows: FakeRow[], opts: { iban?: string; sheet?: string } = {}): Buffer {
	const aoa: unknown[][] = [
		[],
		[null, 'Fecha:', '01-01-2026 10:00:00'],
		[],
		[null, 'Cuenta:', opts.iban ?? FAKE_IBAN, null, null, null, null, 'Moneda:', 'EUR'],
		[null, 'Saldo actual', null, '1.234,56'],
		[null, 'Fake Holder'],
		[],
		[null, 'date', 'value_date', 'concept', null, null, null, null, 'amount', 'balance'],
		...rows.map((r) => [
			null,
			r.date,
			r.valueDate,
			r.concept,
			null,
			null,
			null,
			null,
			r.amount,
			r.balance
		]),
		[],
		[]
	];
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), opts.sheet ?? 'Movimientos');
	return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Buffer;
}

export const sampleRows: FakeRow[] = [
	{
		date: '05/03/2026',
		valueDate: '05/03/2026',
		concept: 'COMPRA  MERCADONA   BCN',
		amount: -42,
		balance: 1000.5
	},
	{
		date: '04/03/2026',
		valueDate: '04/03/2026',
		concept: 'BIZUM A FAKE PERSON',
		amount: -19.99,
		balance: 1042.5
	},
	{
		date: '03/03/2026',
		valueDate: '02/03/2026',
		concept: 'TRF.EX 123 DE FAKE NAME',
		amount: 1500,
		balance: 1062.49
	}
];
