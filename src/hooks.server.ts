import { DATABASE_URL } from '$app/env/private';
import type { ServerInit } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db/index.ts';
import { runMigrationsAndSeed, waitForDb } from '#lib/server/db/migrate.ts';

/** Runs once when the server starts, before the first request is handled. */
export const init: ServerInit = async () => {
	const url = DATABASE_URL;
	await waitForDb(url);
	await runMigrationsAndSeed(getDb(url));
	console.log('[db] migrations applied and seed complete');
};
