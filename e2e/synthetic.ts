import { createDb, type DbHandle } from '../src/lib/server/db/index.ts';
import { importBatches, recurringEntries, statements } from '../src/lib/server/db/schema.ts';
import { seedStatements, type SeedStatement } from '../src/lib/server/analytics/test-seed.ts';
import { E2E_DATABASE_URL } from './db.mjs';

/**
 * Deterministic SYNTHETIC household (fake merchants and names, fake IBAN in test-seed):
 * nine months, Jul 2025 to Mar 2026, one uncategorised charge per month.
 */
export function syntheticStatements(): SeedStatement[] {
	let seed = 7;
	const rand = (lo: number, hi: number) => {
		seed = (seed * 16807) % 2147483647;
		return lo + (seed % (hi - lo + 1));
	};
	type Row = Omit<SeedStatement, 'balance'>;
	const rows: Row[] = [];
	const months = [
		'2025-07',
		'2025-08',
		'2025-09',
		'2025-10',
		'2025-11',
		'2025-12',
		'2026-01',
		'2026-02',
		'2026-03'
	];
	for (const m of months) {
		const at = (d: number) => `${m}-${String(d).padStart(2, '0')}`;
		rows.push({
			date: at(1),
			concept: 'TRF.EX NOMINA DE FAKE DAVID',
			cents: 220000,
			category: 'salary-contributions',
			person: 'David'
		});
		rows.push({
			date: at(2),
			concept: 'TRF.EX NOMINA DE FAKE JOANNA',
			cents: 180000,
			category: 'salary-contributions',
			person: 'Joanna'
		});
		rows.push({
			date: at(3),
			concept: 'RECIBO ALQUILER FAKE CASA',
			cents: -95000,
			category: 'rent-housing'
		});
		rows.push({
			date: at(4),
			concept: 'TRASPASO A AHORRO FAKE',
			cents: -30000,
			category: 'internal-transfer'
		});
		for (const d of [5, 12, 19, 26]) {
			rows.push({
				date: at(d),
				concept: `TARJETA-MERCADONA FAKE ${d}`,
				cents: -rand(4000, 9500),
				category: 'supermarket'
			});
		}
		for (const d of [7, 14, 21]) {
			rows.push({
				date: at(d),
				concept: `TARJETA-CAFE ZZQ ${d}`,
				cents: -rand(1800, 4200),
				category: 'eating-out'
			});
		}
		rows.push({
			date: at(8),
			concept: 'TARJETA-FAKE FUEL STATION',
			cents: -rand(5000, 7000),
			category: 'car'
		});
		rows.push({
			date: at(22),
			concept: 'TARJETA-FAKE FUEL STATION',
			cents: -rand(4500, 6500),
			category: 'car'
		});
		rows.push({
			date: at(10),
			concept: 'RECIBO FAKE ENERGIA',
			cents: -rand(6500, 11000),
			category: 'utilities'
		});
		rows.push({
			date: at(15),
			concept: 'RECIBO NETFLIX 000111',
			cents: -1299,
			category: 'subscriptions'
		});
		rows.push({
			date: at(20),
			concept: 'RECIBO SPOTIFY 000222',
			cents: -1099,
			category: 'subscriptions'
		});
		rows.push({ date: at(24), concept: 'TARJETA-UNKNOWN SHOP QQX', cents: -2000 });
	}
	rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	let balance = 450000;
	return rows.map((r) => ({ ...r, balance: (balance += r.cents) }));
}

/** Net effect of the synthetic data on the balance, in cents (for assertions). */
export const SYNTHETIC_LAST_BALANCE = () => syntheticStatements().at(-1)!.balance!;

export async function resetStatements(handle: DbHandle): Promise<void> {
	await handle.db.delete(statements);
	await handle.db.delete(recurringEntries);
	await handle.db.delete(importBatches);
}

/** Replaces the e2e database contents with the synthetic dataset (or just empties it). */
export async function seedSynthetic(url = E2E_DATABASE_URL, rows = syntheticStatements()) {
	const handle = createDb(url);
	try {
		await resetStatements(handle);
		if (rows.length) await seedStatements(handle.db, rows);
	} finally {
		await handle.pool.end();
	}
}
