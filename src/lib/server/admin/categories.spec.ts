import { describe, expect, it } from 'vitest';
import { validateCategory } from './categories.ts';

const base = { name: 'Pets', color: '#B45309', kind: 'expense', sortOrder: '10' };

describe('validateCategory icon', () => {
	it('accepts a registry key and treats empty as "no explicit icon"', () => {
		const ok = validateCategory({ ...base, icon: 'paw-print' });
		expect(ok.ok && ok.value.icon).toBe('paw-print');
		const none = validateCategory({ ...base, icon: '' });
		expect(none.ok && none.value.icon).toBeNull();
		const missing = validateCategory(base);
		expect(missing.ok && missing.value.icon).toBeNull();
	});

	it('rejects keys outside the registry, including the internal marker and prototype keys', () => {
		for (const icon of ['rocket', 'circle-dashed', '__proto__', 'toString', '<script>']) {
			const res = validateCategory({ ...base, icon });
			expect(res.ok, icon).toBe(false);
			expect(!res.ok && res.errors.icon, icon).toMatch(/icon/i);
		}
	});
});
