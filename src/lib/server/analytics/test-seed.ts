import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { accounts, categories, importBatches, people, statements } from '../db/schema.ts';

export interface SeedStatement {
	date: string;
	concept: string;
	cents: number;
	category?: string;
	person?: string;
	balance?: number;
}

let counter = 0;

/** Inserts synthetic statements (fake account) straight into the DB, for analytics tests. */
export async function seedStatements(db: Db, rows: SeedStatement[]): Promise<void> {
	await db
		.insert(accounts)
		.values({ iban: 'ES0000000000000000000000', name: 'Test' })
		.onDuplicateKeyUpdate({ set: { name: 'Test' } });
	const [account] = await db.select().from(accounts);
	const [{ insertId }] = await db.insert(importBatches).values({
		importerId: 'test',
		filename: 'seed.xls',
		fileSha256: 'a'.repeat(64),
		accountId: account.id
	});
	const cats = new Map((await db.select().from(categories)).map((c) => [c.slug, c.id]));
	const ppl = new Map((await db.select().from(people)).map((p) => [p.name, p.id]));
	for (const r of rows) {
		await db.insert(statements).values({
			accountId: account.id,
			importerId: 'test',
			dedupHash: String(++counter).padStart(64, '0'),
			bookingDate: r.date,
			valueDate: r.date,
			concept: r.concept,
			amountCents: r.cents,
			balanceCents: r.balance ?? null,
			rawJson: {},
			batchId: Number(insertId),
			categoryId: r.category ? (cats.get(r.category) ?? null) : null,
			categorySource: r.category ? 'rule' : null,
			personId: r.person ? (ppl.get(r.person) ?? null) : null
		});
	}
}

export async function clearStatements(db: Db): Promise<void> {
	await db.delete(statements).where(eq(statements.id, statements.id));
}

/** Small dataset shared by the analytics specs (all amounts in cents). */
export const dataset: SeedStatement[] = [
	{
		date: '2026-01-02',
		concept: 'TRF.EX 1 DE FAKE DAVID',
		cents: 200000,
		category: 'salary-contributions',
		person: 'David',
		balance: 500000
	},
	{
		date: '2026-01-03',
		concept: 'TRF.EX 2 DE FAKE JOANNA',
		cents: 150000,
		category: 'salary-contributions',
		person: 'Joanna',
		balance: 650000
	},
	{ date: '2026-01-05', concept: 'TARJETA-MERCADONA PORT', cents: -10000, category: 'supermarket' },
	{
		date: '2026-01-10',
		concept: 'TRASPASO A AHORRO',
		cents: -50000,
		category: 'internal-transfer'
	},
	{ date: '2026-01-15', concept: 'RECIBO NETFLIX 000111', cents: -1299, category: 'subscriptions' },
	{
		date: '2026-02-02',
		concept: 'TRF.EX 3 DE FAKE DAVID',
		cents: 200000,
		category: 'salary-contributions',
		person: 'David'
	},
	{
		date: '2026-02-03',
		concept: 'TRF.EX 4 DE FAKE JOANNA',
		cents: 150000,
		category: 'salary-contributions',
		person: 'Joanna'
	},
	{
		date: '2026-02-06',
		concept: 'TARJETA-MERCADONA PORT 1234',
		cents: -20000,
		category: 'supermarket'
	},
	{ date: '2026-02-15', concept: 'RECIBO NETFLIX 000222', cents: -1299, category: 'subscriptions' },
	{
		date: '2026-03-02',
		concept: 'TRF.EX 5 DE FAKE DAVID',
		cents: 200000,
		category: 'salary-contributions',
		person: 'David'
	},
	{
		date: '2026-03-05',
		concept: 'TARJETA-MERCADONA PORT 9',
		cents: -30000,
		category: 'supermarket'
	},
	{ date: '2026-03-07', concept: 'TARJETA-UNKNOWN SHOP', cents: -5000 },
	{ date: '2026-03-16', concept: 'RECIBO NETFLIX 000333', cents: -1299, category: 'subscriptions' },
	// Same day, two rows: the first listed in the bank file (lowest id) is the latest movement.
	{
		date: '2026-04-14',
		concept: 'RECIBO NETFLIX 000444',
		cents: -1299,
		category: 'subscriptions',
		balance: 777700
	},
	{
		date: '2026-04-14',
		concept: 'TARJETA-OTHER SAME DAY',
		cents: -100,
		category: 'shopping',
		balance: 777800
	}
];
