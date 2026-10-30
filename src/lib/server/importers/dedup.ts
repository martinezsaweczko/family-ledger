import { createHash } from 'node:crypto';
import type { ParsedRow } from './types.ts';

export function normaliseConcept(concept: string): string {
	return concept.replace(/\s+/g, ' ').trim();
}

/**
 * dedup_hash = sha256(account|booking|value|concept|amount|balance-after).
 * The balance makes genuinely identical same-day purchases distinct while
 * overlapping exports of the same movement collapse. Without a balance, identical
 * tuples get a per-file occurrence counter so they still stay distinct.
 */
export function computeDedupHashes(accountId: number, rows: ParsedRow[]): string[] {
	const seen = new Map<string, number>();
	return rows.map((r) => {
		let key = `${accountId}|${r.bookingDate}|${r.valueDate}|${normaliseConcept(r.concept)}|${r.amountCents}|${r.balanceCents ?? ''}`;
		if (r.balanceCents === null) {
			const n = seen.get(key) ?? 0;
			seen.set(key, n + 1);
			key += `|${n}`;
		}
		return createHash('sha256').update(key).digest('hex');
	});
}
