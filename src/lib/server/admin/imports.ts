import { and, count, desc, eq, isNull, ne } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { accounts, importBatches, statements } from '../db/schema.ts';
import { ImportError, importFile, type ImportSummary } from '../importers/import-service.ts';
import { importers } from '../importers/registry.ts';

export type UploadResult =
	| { ok: true; filename: string; summary: ImportSummary; uncategorised: number }
	| { ok: false; filename: string; error: string };

export function supportedImporters() {
	return importers.map((i) => ({ id: i.id, label: i.label, accepts: i.accepts }));
}

/** Imports each uploaded file independently: one bad file never blocks the others. */
export async function importUploads(
	files: { name: string; buffer: Buffer }[],
	db: Db = getDb()
): Promise<UploadResult[]> {
	const results: UploadResult[] = [];
	for (const file of files) {
		try {
			if (file.buffer.length === 0) throw new ImportError(`"${file.name}" is empty.`);
			const summary = await importFile({ buffer: file.buffer, filename: file.name }, db);
			const [{ n }] = await db
				.select({ n: count() })
				.from(statements)
				.where(and(eq(statements.batchId, summary.batchId), isNull(statements.categoryId)));
			results.push({ ok: true, filename: file.name, summary, uncategorised: n });
		} catch (err) {
			if (err instanceof ImportError) {
				results.push({ ok: false, filename: file.name, error: err.message });
			} else {
				console.error('[import] unexpected failure', err);
				results.push({
					ok: false,
					filename: file.name,
					error: 'Something went wrong while importing this file. Nothing was saved.'
				});
			}
		}
	}
	return results;
}

export async function listBatches(limit = 50, db: Db = getDb()) {
	return db
		.select({
			id: importBatches.id,
			filename: importBatches.filename,
			importerId: importBatches.importerId,
			iban: accounts.iban,
			rowsTotal: importBatches.rowsTotal,
			rowsInserted: importBatches.rowsInserted,
			rowsUpdated: importBatches.rowsUpdated,
			rowsUnchanged: importBatches.rowsUnchanged,
			importedAt: importBatches.importedAt
		})
		.from(importBatches)
		.innerJoin(accounts, eq(importBatches.accountId, accounts.id))
		.where(ne(importBatches.importerId, 'manual'))
		.orderBy(desc(importBatches.id))
		.limit(limit);
}
