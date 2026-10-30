import { describe, expect, it } from 'vitest';
import { detectRecurring } from './merchants.ts';

const row = (date: string, cents: number, merchant = 'GYM') => ({ date, merchant, cents });

describe('detectRecurring', () => {
	it('needs at least 3 charges', () => {
		expect(detectRecurring([row('2026-01-01', 3000), row('2026-02-01', 3000)])).toEqual([]);
	});

	it('accepts monthly cadence within +-5 days and +-15% amount', () => {
		const found = detectRecurring([
			row('2026-01-03', 3000),
			row('2026-02-01', 3200),
			row('2026-03-05', 2900)
		]);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ occurrences: 3, medianCents: 3000, lastDate: '2026-03-05' });
	});

	it('rejects weekly spend and wildly varying amounts', () => {
		const weekly = ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22'].map((d) =>
			row(d, 2000)
		);
		expect(detectRecurring(weekly)).toEqual([]);
		const varying = [row('2026-01-01', 1000), row('2026-02-01', 5000), row('2026-03-01', 9000)];
		expect(detectRecurring(varying)).toEqual([]);
	});
});
