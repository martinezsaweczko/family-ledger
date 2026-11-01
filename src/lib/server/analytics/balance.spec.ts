import { describe, expect, it } from 'vitest';
import { lastBalancePerBucket } from './balance.ts';

describe('lastBalancePerBucket', () => {
	// Rows arrive ordered date ASC, id DESC: the last row of a day is its latest movement.
	const rows = [
		{ date: '2026-01-02', cents: 100 },
		{ date: '2026-01-20', cents: 300 },
		{ date: '2026-01-20', cents: 250 },
		{ date: '2026-03-05', cents: 500 }
	];
	it('keeps the closing balance of each month and carries it across empty buckets', () => {
		expect(lastBalancePerBucket(rows, 'month', '2026-01-01', '2026-03-31')).toEqual([
			{ bucket: '2026-01-01', balanceCents: 250 },
			{ bucket: '2026-02-01', balanceCents: 250 },
			{ bucket: '2026-03-01', balanceCents: 500 }
		]);
	});
	it('leaves buckets before the first known balance out', () => {
		expect(lastBalancePerBucket(rows, 'month', '2025-11-01', '2026-01-31')).toEqual([
			{ bucket: '2026-01-01', balanceCents: 250 }
		]);
	});
	it('returns nothing without data', () => {
		expect(lastBalancePerBucket([], 'month', '2026-01-01', '2026-03-31')).toEqual([]);
	});
});
