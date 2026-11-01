import { describe, expect, it } from 'vitest';
import { computeDedupHashes, normaliseConcept } from './dedup.ts';
import type { ParsedRow } from './types.ts';

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
	bookingDate: '2026-03-05',
	valueDate: '2026-03-05',
	concept: 'COMPRA MERCADONA',
	amountCents: -4200,
	balanceCents: 100050,
	raw: {},
	...over
});

describe('normaliseConcept', () => {
	it('collapses whitespace and trims', () => {
		expect(normaliseConcept('  A   B \t C  ')).toBe('A B C');
	});
});

describe('computeDedupHashes', () => {
	it('is a stable 64-char sha256 hex', () => {
		const [h] = computeDedupHashes(1, [row()]);
		expect(h).toMatch(/^[0-9a-f]{64}$/);
		expect(computeDedupHashes(1, [row()])[0]).toBe(h);
	});

	it('ignores internal whitespace differences in the concept', () => {
		expect(computeDedupHashes(1, [row({ concept: 'COMPRA   MERCADONA' })])[0]).toBe(
			computeDedupHashes(1, [row()])[0]
		);
	});

	it('differs by account, amount and balance', () => {
		const base = computeDedupHashes(1, [row()])[0];
		expect(computeDedupHashes(2, [row()])[0]).not.toBe(base);
		expect(computeDedupHashes(1, [row({ amountCents: -4300 })])[0]).not.toBe(base);
		expect(computeDedupHashes(1, [row({ balanceCents: 100000 })])[0]).not.toBe(base);
	});

	it('keeps identical same-day purchases distinct thanks to the balance', () => {
		const [a, b] = computeDedupHashes(1, [row(), row({ balanceCents: 95850 })]);
		expect(a).not.toBe(b);
	});

	it('uses an occurrence counter for identical tuples when balance is null', () => {
		const [a, b, c] = computeDedupHashes(1, [
			row({ balanceCents: null }),
			row({ balanceCents: null }),
			row({ balanceCents: null, amountCents: -1 })
		]);
		expect(a).not.toBe(b);
		expect(c).not.toBe(a);
		const again = computeDedupHashes(1, [row({ balanceCents: null }), row({ balanceCents: null })]);
		expect(again).toEqual([a, b]);
	});
});
