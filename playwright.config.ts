import { defineConfig } from '@playwright/test';

// The preview server runs against a dedicated throwaway database (never the dev one).
// `e2e/db.mjs create` (re)creates it before the build; global teardown drops it.
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'mysql://root:root@127.0.0.1:3306';

export default defineConfig({
	webServer: {
		command: 'node e2e/db.mjs create && npm run build && npm run preview',
		port: 4173,
		timeout: 180_000,
		env: { DATABASE_URL: `${ADMIN_URL}/hearth_e2e` }
	},
	globalTeardown: './e2e/global-teardown.mjs',
	testMatch: '**/*.e2e.{ts,js}'
});
