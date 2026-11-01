import { describe, expect, it } from 'vitest';
import { seedCategories } from '../server/db/seed-data.ts';
import {
	DEFAULT_ICON_BY_SLUG,
	FALLBACK_ICON,
	ICONS,
	PICKABLE_ICON_KEYS,
	UNCATEGORISED_ICON,
	isIconKey,
	resolveIcon
} from './registry.ts';

describe('icon registry', () => {
	it('has an icon for every seeded category, and the seed stores a valid key', () => {
		for (const c of seedCategories) {
			expect(isIconKey(c.icon), `${c.slug} icon`).toBe(true);
			expect(DEFAULT_ICON_BY_SLUG[c.slug], c.slug).toBe(c.icon);
		}
	});

	it('only maps to icons that exist, and every icon draws something', () => {
		for (const key of Object.values(DEFAULT_ICON_BY_SLUG)) expect(ICONS).toHaveProperty(key);
		for (const [key, def] of Object.entries(ICONS)) {
			expect(def.nodes.length, key).toBeGreaterThan(0);
			expect(def.label.length, key).toBeGreaterThan(2);
		}
		expect(ICONS).toHaveProperty(FALLBACK_ICON);
		expect(ICONS).toHaveProperty(UNCATEGORISED_ICON);
	});

	it('validates keys strictly (no prototype keys, no unknown strings)', () => {
		expect(isIconKey('zap')).toBe(true);
		expect(isIconKey('nope')).toBe(false);
		expect(isIconKey('toString')).toBe(false);
		expect(isIconKey(null)).toBe(false);
		expect(isIconKey(42)).toBe(false);
	});

	it('resolves stored key, then slug default, then fallback', () => {
		expect(resolveIcon('car', 'utilities')).toBe('car');
		expect(resolveIcon(null, 'utilities')).toBe('zap');
		expect(resolveIcon('bogus', 'pets')).toBe('paw-print');
		expect(resolveIcon(null, 'my-custom')).toBe(FALLBACK_ICON);
		expect(resolveIcon(undefined)).toBe(FALLBACK_ICON);
	});

	it('does not offer the internal uncategorised marker in the picker', () => {
		expect(PICKABLE_ICON_KEYS).not.toContain(UNCATEGORISED_ICON);
		expect(PICKABLE_ICON_KEYS.length).toBeGreaterThanOrEqual(30);
	});
});
