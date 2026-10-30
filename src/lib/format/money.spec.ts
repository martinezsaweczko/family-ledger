import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
	it('formats integer cents as currency', () => {
		expect(formatMoney(123456, 'EUR', 'en-GB')).toBe('€1,234.56');
	});

	it('formats negative amounts', () => {
		expect(formatMoney(-500, 'EUR', 'en-GB')).toBe('-€5.00');
	});
});
