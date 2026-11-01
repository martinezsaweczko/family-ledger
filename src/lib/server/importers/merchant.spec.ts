import { describe, expect, it } from 'vitest';
import { cleanMerchant } from './merchant.ts';

describe('cleanMerchant', () => {
	it.each([
		['TARJETA-MERCADONA PORT', 'MERCADONA PORT'],
		['TARJETA-5895 CAPRABO BADALONA', 'CAPRABO BADALONA'],
		['TARJETA-AIRBNB * HMFNFSPJQK', 'AIRBNB'],
		['TARJETA-Revolut**8864*', 'REVOLUT'],
		['TARJETA-zooplus ES 123456789', 'ZOOPLUS ES'],
		['TARJETA-SUPERMERCAT CONDIS 3707', 'SUPERMERCAT CONDIS'],
		['RECIBO DIGI SPAIN TELECOM SA', 'DIGI SPAIN TELECOM SA'],
		['RECIBO  ENERGIA XXI   COMERCIALIZADOR 000123456', 'ENERGIA XXI COMERCIALIZADOR'],
		['COMPRA  MERCADONA   BCN', 'MERCADONA BCN'],
		['TARJETA-NYX*FITVENDINGSL', 'NYX*FITVENDINGSL'],
		['TARJETA-GOOD NEWS BARCELONA 2020,', 'GOOD NEWS BARCELONA']
	])('%s -> %s', (input, expected) => {
		expect(cleanMerchant(input)).toBe(expected);
	});

	it('falls back to the trimmed upper-case text when nothing is left', () => {
		expect(cleanMerchant('TARJETA-12345')).toBe('12345');
		expect(cleanMerchant('   ')).toBe('');
	});

	it('caps very long names', () => {
		expect(cleanMerchant('A'.repeat(200)).length).toBeLessThanOrEqual(60);
	});
});
