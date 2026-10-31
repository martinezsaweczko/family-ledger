import { describe, expect, it } from 'vitest';
import { parsePref, resolveTheme, nextPref } from './theme.ts';

describe('parsePref', () => {
	it('accepts the three known values', () => {
		expect(parsePref('light')).toBe('light');
		expect(parsePref('dark')).toBe('dark');
		expect(parsePref('system')).toBe('system');
	});
	it('falls back to system for anything else', () => {
		expect(parsePref(null)).toBe('system');
		expect(parsePref(undefined)).toBe('system');
		expect(parsePref('')).toBe('system');
		expect(parsePref('DARK')).toBe('system');
		expect(parsePref('{"x":1}')).toBe('system');
	});
});

describe('resolveTheme', () => {
	it('explicit choices ignore the system preference', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
	it('system follows prefers-color-scheme', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});
	it('treats a stored garbage value as system', () => {
		expect(resolveTheme(parsePref('purple'), true)).toBe('dark');
	});
});

describe('nextPref', () => {
	it('moves through the options with wrap-around', () => {
		expect(nextPref('system', 1)).toBe('light');
		expect(nextPref('light', 1)).toBe('dark');
		expect(nextPref('dark', 1)).toBe('system');
		expect(nextPref('system', -1)).toBe('dark');
	});
});
