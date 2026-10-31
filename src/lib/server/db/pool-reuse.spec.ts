import { afterEach, describe, expect, it, vi } from 'vitest';

const created: unknown[] = [];
vi.mock('mysql2/promise', () => ({
	createPool: vi.fn(() => {
		const pool = { end: vi.fn() };
		created.push(pool);
		return pool;
	})
}));

const KEY = Symbol.for('hearth.db.handle');
const reset = () => {
	delete (globalThis as Record<symbol, unknown>)[KEY];
	created.length = 0;
};

describe('getDb pool reuse across module reloads (HMR)', () => {
	afterEach(() => {
		reset();
		vi.unstubAllEnvs();
	});

	it('creates one pool even when the module is evaluated repeatedly (dev)', async () => {
		reset();
		const urls = 'mysql://u:p@127.0.0.1:3306/x';
		const first = (await import('./index.ts')).getDb(urls);
		for (let i = 0; i < 3; i++) {
			vi.resetModules(); // what an HMR reload does: a fresh module instance
			const again = (await import('./index.ts')).getDb(urls);
			expect(again).toBe(first);
		}
		expect(created).toHaveLength(1);
	});

	it('production keeps a module-level singleton and does not touch globalThis', async () => {
		reset();
		vi.stubEnv('NODE_ENV', 'production');
		vi.resetModules();
		const mod = await import('./index.ts');
		const a = mod.getDb('mysql://u:p@127.0.0.1:3306/x');
		expect(mod.getDb()).toBe(a);
		expect(created).toHaveLength(1);
		expect((globalThis as Record<symbol, unknown>)[KEY]).toBeUndefined();
	});
});
