import {
	AI_API_KEY,
	AI_BASE_URL,
	AI_MIN_CONFIDENCE,
	AI_MODEL,
	AI_TIMEOUT_MS,
	DATABASE_URL
} from '$app/env/private';
import { configureAi } from '#lib/server/ai/config.ts';
import type { ServerInit } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db/index.ts';
import { materialiseRecurring } from '#lib/server/manual/recurring.ts';
import { runMigrationsAndSeed, waitForDb } from '#lib/server/db/migrate.ts';

/** Runs once when the server starts, before the first request is handled. */
export const init: ServerInit = async () => {
	configureAi({ AI_BASE_URL, AI_MODEL, AI_API_KEY, AI_TIMEOUT_MS, AI_MIN_CONFIDENCE });
	const url = DATABASE_URL;
	await waitForDb(url);
	await runMigrationsAndSeed(getDb(url));
	console.log('[db] migrations applied and seed complete');
	try {
		const { inserted } = await materialiseRecurring();
		if (inserted) console.log(`[recurring] generated ${inserted} manual entries`);
	} catch (e) {
		console.error('[recurring] could not generate entries at start', e);
	}
};
