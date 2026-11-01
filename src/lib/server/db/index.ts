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

/**
 * In dev, Vite re-evaluates this module on every HMR reload; a module-level variable would then
 * open a fresh pool each time and leak the old one (~150 idle connections were observed). The
 * handle therefore lives on `globalThis` under a symbol key. Production evaluates the module
 * once, so it keeps a plain module variable (identical behaviour to before).
 */
export const HANDLE_KEY = Symbol.for('hearth.db.handle');
type Store = { [HANDLE_KEY]?: DbHandle };
const keepOnGlobal = process.env.NODE_ENV !== 'production';

let handle: DbHandle | undefined;
const read = () => (keepOnGlobal ? (globalThis as Store)[HANDLE_KEY] : handle);
const write = (h: DbHandle) => {
	if (keepOnGlobal) (globalThis as Store)[HANDLE_KEY] = h;
	else handle = h;
};

/** Lazy app-wide singleton. `url` is only used on the first call. */
export function getDb(url?: string): Db {
	let current = read();
	if (!current) {
		const resolved = url ?? process.env.DATABASE_URL;
		if (!resolved) throw new Error('DATABASE_URL is not set');
		current = createDb(resolved);
		write(current);
	}
	return current.db;
}

export * as schema from './schema.ts';
