import { createHash } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { accounts, importBatches, statements } from '../db/schema.ts';
import { computeDedupHashes } from './dedup.ts';
import { detectImporter, getImporter } from './registry.ts';

export interface ImportSummary {
	batchId: number;
	importerId: string;
	filename: string;
	accountId: number;
	iban: string;
	rowsTotal: number;
	rowsInserted: number;
	rowsUpdated: number;
	rowsUnchanged: number;
}

export class ImportError extends Error {}

const CHUNK = 500;

/** JSON.stringify with sorted keys: MySQL JSON columns do not preserve key order. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value && typeof value === 'object') {
		const o = value as Record<string, unknown>;
		return `{${Object.keys(o)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

function chunks<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/**
 * Imports one bank file. Re-importing the same or an overlapping file never
 * double counts: rows are upserted by dedup_hash and manual categories survive.
 */
export async function importFile(
	opts: { buffer: Buffer; filename: string; importerId?: string },
	db: Db = getDb()
): Promise<ImportSummary> {
	const importer = opts.importerId
		? getImporter(opts.importerId)
		: detectImporter(opts.buffer, opts.filename);
	if (!importer) {
		throw new ImportError(
			opts.importerId
				? `Unknown importer "${opts.importerId}"`
				: `Could not recognise the format of "${opts.filename}"`
		);
	}
	let parsed;
	try {
		parsed = importer.parse(opts.buffer);
	} catch (err) {
		throw new ImportError(`Failed to parse "${opts.filename}": ${(err as Error).message}`);
	}
	const fileSha256 = createHash('sha256').update(opts.buffer).digest('hex');

	return db.transaction(async (tx) => {
		await tx
			.insert(accounts)
			.values({
				iban: parsed.account.iban,
				name: `Account ••••${parsed.account.iban.slice(-4)}`,
				currency: parsed.account.currency
			})
			.onDuplicateKeyUpdate({ set: { iban: sql`iban` } });
		const [account] = await tx
			.select()
			.from(accounts)
			.where(eq(accounts.iban, parsed.account.iban));

		const [{ insertId }] = await tx.insert(importBatches).values({
			importerId: importer.id,
			filename: opts.filename.slice(0, 255),
			fileSha256,
			accountId: account.id,
			rowsTotal: parsed.rows.length
		});
		const batchId = Number(insertId);

		const hashes = computeDedupHashes(account.id, parsed.rows);
		// Identical hashes inside one file are the same movement: keep one.
		const unique = new Map<string, (typeof parsed.rows)[number]>();
		hashes.forEach((h, i) => {
			if (!unique.has(h)) unique.set(h, parsed.rows[i]);
		});

		const existing = new Map<string, string>();
		for (const part of chunks([...unique.keys()], CHUNK)) {
			const found = await tx
				.select({ hash: statements.dedupHash, raw: statements.rawJson })
				.from(statements)
				.where(inArray(statements.dedupHash, part));
			for (const f of found) existing.set(f.hash, canonical(f.raw));
		}

		let inserted = 0;
		let updated = 0;
		for (const [hash, row] of unique) {
			const prev = existing.get(hash);
			if (prev === undefined) inserted++;
			else if (prev !== canonical(row.raw)) updated++;
		}

		for (const part of chunks([...unique], CHUNK)) {
			await tx
				.insert(statements)
				.values(
					part.map(([dedupHash, r]) => ({
						accountId: account.id,
						importerId: importer.id,
						dedupHash,
						bookingDate: r.bookingDate,
						valueDate: r.valueDate,
						concept: r.concept,
						amountCents: r.amountCents,
						balanceCents: r.balanceCents,
						rawJson: r.raw,
						batchId
					}))
				)
				.onDuplicateKeyUpdate({
					set: {
						lastSeenAt: sql`NOW()`,
						batchId: sql`VALUES(batch_id)`,
						rawJson: sql`VALUES(raw_json)`
					}
				});
		}

		const rowsUnchanged = parsed.rows.length - inserted - updated;
		await tx
			.update(importBatches)
			.set({ rowsInserted: inserted, rowsUpdated: updated, rowsUnchanged })
			.where(eq(importBatches.id, batchId));

		return {
			batchId,
			importerId: importer.id,
			filename: opts.filename,
			accountId: account.id,
			iban: parsed.account.iban,
			rowsTotal: parsed.rows.length,
			rowsInserted: inserted,
			rowsUpdated: updated,
			rowsUnchanged
		};
	});
}
