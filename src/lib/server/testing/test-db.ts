import { createPool } from 'mysql2/promise';
import { createDb, type DbHandle } from '../db/index.ts';
import { runMigrationsAndSeed } from '../db/migrate.ts';

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'mysql://root:root@127.0.0.1:3306';
const TEST_DB = 'hearth_test';

/**
 * Creates a throwaway `hearth_test` database on the local MySQL, migrated and seeded.
 * Returns null (so the caller can skip) when MySQL is unreachable.
 */
export async function setupTestDb(): Promise<DbHandle | null> {
	const admin = createPool({ uri: ADMIN_URL, connectionLimit: 1 });
	try {
		await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
		await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4`);
	} catch (err) {
		console.warn(
			`[test-db] MySQL unreachable at the admin URL, skipping DB tests: ${(err as Error).message}`
		);
		await admin.end().catch(() => {});
		return null;
	}
	await admin.end();
	const handle = createDb(`${ADMIN_URL}/${TEST_DB}`);
	await runMigrationsAndSeed(handle.db);
	return handle;
}
