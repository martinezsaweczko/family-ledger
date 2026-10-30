import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import * as schema from './schema.ts';

export type Db = MySql2Database<typeof schema>;

export interface DbHandle {
	db: Db;
	pool: Pool;
}

export function createDb(url: string): DbHandle {
	const pool = createPool({ uri: url, connectionLimit: 10, dateStrings: true });
	return { db: drizzle(pool, { schema, mode: 'default' }), pool };
}

let handle: DbHandle | undefined;

/** Lazy app-wide singleton. `url` is only used on the first call. */
export function getDb(url?: string): Db {
	if (!handle) {
		const resolved = url ?? process.env.DATABASE_URL;
		if (!resolved) throw new Error('DATABASE_URL is not set');
		handle = createDb(resolved);
	}
	return handle.db;
}

export * as schema from './schema.ts';
