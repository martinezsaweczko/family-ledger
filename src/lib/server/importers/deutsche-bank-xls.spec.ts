import { describe, expect, it } from 'vitest';
import { deutscheBankXls } from './deutsche-bank-xls.ts';
import { buildDbXls, FAKE_IBAN, sampleRows } from './test-fixtures.ts';

describe('deutsche-bank-xls importer', () => {
	const buf = buildDbXls(sampleRows);

	it('detects its own format and rejects others', () => {
		expect(deutscheBankXls.detect(buf, 'mov.xls')).toBe(true);
		expect(deutscheBankXls.detect(buf, 'mov.csv')).toBe(false);
		expect(deutscheBankXls.detect(buildDbXls(sampleRows, { sheet: 'Other' }), 'mov.xls')).toBe(
			false
		);
		expect(deutscheBankXls.detect(Buffer.from('not a spreadsheet'), 'mov.xls')).toBe(false);
	});

	it('parses account, currency and rows (ignoring trailing empty rows)', () => {
		const parsed = deutscheBankXls.parse(buf);
		expect(parsed.account).toEqual({ iban: FAKE_IBAN, currency: 'EUR' });
		expect(parsed.rows).toHaveLength(3);
		expect(parsed.rows[2]).toMatchObject({
			bookingDate: '2026-03-03',
			valueDate: '2026-03-02',
			amountCents: 150000,
			balanceCents: 106249
		});
	});

	it('converts floats to integer cents with rounding', () => {
		const [, second] = deutscheBankXls.parse(buf).rows;
		expect(second.amountCents).toBe(-1999);
		expect(second.balanceCents).toBe(104250);
	});

	it('keeps the original concept in raw and exposes it as concept', () => {
		const [first] = deutscheBankXls.parse(buf).rows;
		expect(first.concept).toBe('COMPRA  MERCADONA   BCN');
		expect(first.raw).toMatchObject({ concept: 'COMPRA  MERCADONA   BCN', amount: -42 });
	});

	it('throws a clear error when the table header is missing', () => {
		expect(() =>
			deutscheBankXls.parse(buildDbXls([], { sheet: 'Movimientos' }).subarray(0, 10))
		).toThrow();
	});
});
