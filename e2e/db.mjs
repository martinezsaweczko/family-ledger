// Creates / drops the throwaway database used by the Playwright e2e run.
// Never touches the dev `hearth` database: the name is fixed here.
import { createPool } from 'mysql2/promise';

export const E2E_DB = 'hearth_e2e';
export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'mysql://root:root@127.0.0.1:3306';
export const E2E_DATABASE_URL = `${ADMIN_URL}/${E2E_DB}`;

async function run(sql) {
	const pool = createPool({ uri: ADMIN_URL, connectionLimit: 1 });
	try {
		await pool.query(sql);
	} finally {
		await pool.end();
	}
}

export const createE2eDb = async () => {
	await run(`DROP DATABASE IF EXISTS \`${E2E_DB}\``);
	await run(`CREATE DATABASE \`${E2E_DB}\` CHARACTER SET utf8mb4`);
};
export const dropE2eDb = () => run(`DROP DATABASE IF EXISTS \`${E2E_DB}\``);

if (process.argv[1]?.endsWith('db.mjs') && process.argv[2] === 'create') {
	await createE2eDb();
	console.log(`[e2e] database ${E2E_DB} recreated`);
}
