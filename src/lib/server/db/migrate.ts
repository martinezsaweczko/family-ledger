import path from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb, type Db } from './index.ts';
import { seed } from './seed.ts';

/**
 * Migrations live in <cwd>/drizzle. The Docker image runs from /app and copies
 * ./drizzle next to ./build, so cwd-relative resolution works in dev, build and
 * container. MIGRATIONS_DIR overrides it.
 */
export function migrationsFolder(): string {
	return process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry while MySQL is still starting (container boot). */
export async function waitForDb(
	url: string,
	{ attempts = 30, delayMs = 2000 }: { attempts?: number; delayMs?: number } = {}
): Promise<void> {
	let lastError: unknown;
	for (let i = 1; i <= attempts; i++) {
		const { pool } = createDb(url);
		try {
			await pool.query('SELECT 1');
			await pool.end();
			return;
		} catch (err) {
			lastError = err;
			await pool.end().catch(() => {});
			console.warn(`[db] not ready (attempt ${i}/${attempts}), retrying in ${delayMs}ms`);
			await sleep(delayMs);
		}
	}
	throw new Error(`Database unreachable after ${attempts} attempts: ${String(lastError)}`);
}

export async function runMigrationsAndSeed(db: Db, folder = migrationsFolder()): Promise<void> {
	await migrate(db, { migrationsFolder: folder });
	await seed(db);
}
