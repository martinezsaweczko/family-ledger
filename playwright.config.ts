import { defineConfig } from '@playwright/test';

// The preview server runs against a dedicated throwaway database (never the dev one).
// `e2e/db.mjs create` (re)creates it before the build; global teardown drops it.
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'mysql://root:root@127.0.0.1:3306';
const DATABASE_URL = `${ADMIN_URL}/hearth_e2e`;

export default defineConfig({
	use: { baseURL: 'http://localhost:4173' },
	webServer: [
		// Local stand-in for the AI service: tests never reach the network.
		{ command: 'node e2e/ai-stub.mjs', port: 4199, timeout: 30_000 },
		// Main app (AI pointed at the stub). Builds first.
		{
			command: 'node e2e/db.mjs create && npm run build && npm run preview',
			port: 4173,
			timeout: 180_000,
			env: { DATABASE_URL, AI_BASE_URL: 'http://127.0.0.1:4199' }
		},
		// Same build and database, AI unset: proves the disabled state.
		{
			command: 'npm run preview -- --port 4174 --strictPort',
			port: 4174,
			timeout: 60_000,
			env: { DATABASE_URL, AI_BASE_URL: '' }
		}
	],
	workers: 1,
	globalTeardown: './e2e/global-teardown.mjs',
	testMatch: '**/*.e2e.{ts,js}'
});
