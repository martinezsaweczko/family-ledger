import { describe, expect, it } from 'vitest';
import { categorize, type Rule } from './categorizer.ts';

const rule = (over: Partial<Rule>): Rule => ({
	pattern: 'X',
	matchType: 'contains',
	categoryId: 1,
	personId: null,
	priority: 100,
	direction: 'any',
	isActive: true,
	...over
});

describe('categorize', () => {
	it('matches contains case-insensitively', () => {
		const rules = [rule({ pattern: 'mercadona', categoryId: 7 })];
		expect(categorize('COMPRA MERCADONA BCN', -1000, rules)).toEqual({
			categoryId: 7,
			personId: null
		});
		expect(categorize('NETFLIX', -1000, rules)).toBeNull();
	});

	it('matches regex case-insensitively and ignores invalid regexes', () => {
		const rules = [
			rule({ pattern: '([', matchType: 'regex', categoryId: 1 }),
			rule({ pattern: '\\bdia\\b', matchType: 'regex', categoryId: 2 })
		];
		expect(categorize('COMPRA DIA 123', -500, rules)?.categoryId).toBe(2);
		expect(categorize('MEDIA MARKT', -500, rules)).toBeNull();
	});

	it('uses the lowest priority number first, then list order', () => {
		const rules = [
			rule({ pattern: 'AMAZON', categoryId: 1, priority: 100 }),
			rule({ pattern: 'AMAZON PRIME', categoryId: 2, priority: 50 })
		];
		expect(categorize('AMAZON PRIME VIDEO', -999, rules)?.categoryId).toBe(2);
	});

	it('honours the direction filter', () => {
		const rules = [rule({ pattern: 'TRF', categoryId: 3, direction: 'in', personId: 9 })];
		expect(categorize('TRF.EX DE X', 5000, rules)).toEqual({ categoryId: 3, personId: 9 });
		expect(categorize('TRF.EX A X', -5000, rules)).toBeNull();
		expect(categorize('TRF', 0, rules)).toBeNull();
	});

	it('skips inactive rules', () => {
		expect(categorize('NETFLIX', -1, [rule({ pattern: 'NETFLIX', isActive: false })])).toBeNull();
	});

	it('normalises repeated whitespace before matching', () => {
		const rules = [rule({ pattern: 'REINTEGRO CAJERO', categoryId: 4 })];
		expect(categorize('REINTEGRO    CAJERO   123', -2000, rules)?.categoryId).toBe(4);
	});
});

describe('seed rules', async () => {
	const { seedRules } = await import('./db/seed-data.ts');
	const slugs = [...new Set(seedRules.map((r) => r.category))];
	const people = ['David', 'Joanna'];
	const rules: Rule[] = seedRules.map((r) => ({
		pattern: r.pattern,
		matchType: r.matchType,
		categoryId: slugs.indexOf(r.category),
		personId: r.person ? people.indexOf(r.person) + 1 : null,
		priority: r.priority ?? 100,
		direction: r.direction ?? 'any',
		isActive: true
	}));
	const slug = (c: string, amt: number) => {
		const hit = categorize(c, amt, rules);
		return hit ? { slug: slugs[hit.categoryId], person: hit.personId } : null;
	};

	it('attributes incoming transfers to the right person', () => {
		expect(slug('TRF.EX 123 DE DAVID FAKE', 100000)).toEqual({
			slug: 'salary-contributions',
			person: 1
		});
		expect(slug('TRF.EX 9 DE JOANNA FAKE', 100000)).toEqual({
			slug: 'salary-contributions',
			person: 2
		});
		expect(slug('TRF.EX 9 A DAVID', -100000)).toBeNull();
	});

	it('uses word boundaries for short tokens', () => {
		expect(slug('COMPRA DIA 1234', -500)?.slug).toBe('supermarket');
		expect(slug('MEDIA MARKT', -500)).toBeNull();
		expect(slug('GASOLINERA BP 55', -500)?.slug).toBe('car');
	});

	it('maps cash withdrawals and their reversals', () => {
		expect(slug('REINTEGRO CAJERO 1', -5000)?.slug).toBe('cash-withdrawals');
		expect(slug('ANUL.EFECTIVO 1', 5000)?.slug).toBe('cash-withdrawals');
	});
});
