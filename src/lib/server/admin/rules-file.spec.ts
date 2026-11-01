import { describe, expect, it } from 'vitest';
import {
	MAX_FILE_BYTES,
	assignPriorities,
	parseRulesFile,
	planImport,
	ruleKey,
	serializeRulesFile,
	type FileRule,
	type LocalRule,
	type LocalState
} from './rules-file.ts';

const file = (over: Record<string, unknown> = {}) =>
	JSON.stringify({
		format: 'hearth.rules',
		version: 1,
		exportedAt: 'x',
		categories: [],
		rules: [],
		...over
	});
const rule = (over: Record<string, unknown> = {}) => ({
	pattern: 'ZZQ',
	matchType: 'contains',
	direction: 'any',
	categorySlug: 'shopping',
	person: null,
	priority: 10,
	isActive: true,
	...over
});
const cat = (over: Record<string, unknown> = {}) => ({
	slug: 'pets',
	name: 'Pets',
	kind: 'expense',
	color: '#112233',
	icon: null,
	sortOrder: 5,
	isActive: true,
	...over
});

describe('parseRulesFile: file level', () => {
	it('rejects bad JSON, a wrong format, a wrong version and non-lists', () => {
		expect(parseRulesFile('{nope')).toEqual({ ok: false, error: 'The file is not valid JSON.' });
		expect(parseRulesFile('[]')).toMatchObject({ ok: false });
		expect(parseRulesFile(file({ format: 'other' }))).toMatchObject({ ok: false });
		const v2 = parseRulesFile(file({ version: 2 }));
		expect(v2).toMatchObject({ ok: false });
		expect(v2.ok === false && v2.error).toContain('version 2');
		expect(parseRulesFile(file({ rules: {} }))).toMatchObject({ ok: false });
		expect(parseRulesFile(file({ categories: 'x' }))).toMatchObject({ ok: false });
	});
	it('rejects a huge file before parsing it', () => {
		const r = parseRulesFile(' '.repeat(MAX_FILE_BYTES + 1));
		expect(r).toEqual({ ok: false, error: 'The file is larger than 2 MB.' });
	});
	it('ignores unknown fields and a BOM', () => {
		const r = parseRulesFile(`\uFEFF${file({ extra: 1, rules: [rule({ junk: true })] })}`);
		expect(r.ok && r.file.rules).toHaveLength(1);
		expect(r.ok && r.file.rules[0]).not.toHaveProperty('junk');
	});
});

describe('parseRulesFile: entries', () => {
	const reasons = (r: unknown[]) => {
		const out = parseRulesFile(file({ rules: r }));
		return out.ok ? out.invalid.map((i) => i.reason) : [];
	};
	it('reports each invalid rule with a reason and keeps the valid ones', () => {
		const out = parseRulesFile(
			file({
				rules: [
					rule(),
					rule({ pattern: '(', matchType: 'regex' }),
					rule({ pattern: 'A', matchType: 'fuzzy' }),
					rule({ pattern: 'B', direction: 'sideways' }),
					rule({ pattern: 'C', priority: 1.5 }),
					rule({ pattern: 'D', isActive: 'yes' }),
					rule({ pattern: 'x'.repeat(256) }),
					rule({ pattern: '   ' }),
					rule({ pattern: 'E', categorySlug: 'Not A Slug' }),
					'nope'
				]
			})
		);
		expect(out.ok && out.file.rules.map((r) => r.pattern)).toEqual(['ZZQ']);
		expect(out.ok && out.invalid).toHaveLength(9);
		expect(reasons([rule({ pattern: '(', matchType: 'regex' })])[0]).toContain(
			'regular expression'
		);
	});
	it('flags duplicates inside the file (also by case)', () => {
		const out = parseRulesFile(file({ rules: [rule(), rule({ pattern: 'zzq' })] }));
		expect(out.ok && out.file.rules).toHaveLength(1);
		expect(out.ok && out.invalid[0].reason).toContain('Duplicate of rule 1');
		// same pattern, different match type is a different rule
		const ok = parseRulesFile(file({ rules: [rule(), rule({ matchType: 'regex' })] }));
		expect(ok.ok && ok.file.rules).toHaveLength(2);
	});
	it('validates categories (kind, colour, icon, duplicate slug)', () => {
		const out = parseRulesFile(
			file({
				categories: [
					cat(),
					cat({ slug: 'a', kind: 'weird' }),
					cat({ slug: 'b', color: 'red' }),
					cat({ slug: 'c', icon: 'nope-icon' }),
					cat()
				]
			})
		);
		expect(out.ok && out.file.categories.map((c) => c.slug)).toEqual(['pets']);
		expect(out.ok && out.invalid).toHaveLength(4);
	});
	it('serialises with a stable key order and no ids', () => {
		const out = parseRulesFile(file({ categories: [cat()], rules: [rule({ person: 'David' })] }));
		if (!out.ok) throw new Error('parse');
		const text = serializeRulesFile(out.file);
		expect(Object.keys(JSON.parse(text))).toEqual([
			'format',
			'version',
			'exportedAt',
			'categories',
			'rules'
		]);
		expect(Object.keys(JSON.parse(text).rules[0])).toEqual([
			'pattern',
			'matchType',
			'direction',
			'categorySlug',
			'person',
			'priority',
			'isActive'
		]);
		expect(text).not.toMatch(/"(id|categoryId|personId)"/);
		expect(parseRulesFile(text)).toMatchObject({ ok: true, invalid: [] });
	});
});

describe('ruleKey', () => {
	it('mirrors the case/accent-insensitive unique index', () => {
		expect(ruleKey('Café ', 'contains')).toBe(ruleKey('cafe', 'contains'));
		expect(ruleKey('cafe', 'regex')).not.toBe(ruleKey('cafe', 'contains'));
	});
});

describe('planImport', () => {
	const local = (rules: Partial<LocalRule>[] = []): LocalState => ({
		rules: rules.map((r, i) => ({
			id: i + 1,
			pattern: 'ZZQ',
			matchType: 'contains',
			direction: 'any',
			categorySlug: 'shopping',
			person: null,
			priority: 10,
			isActive: true,
			...r
		})),
		categorySlugs: new Set(['shopping', 'supermarket']),
		people: new Set(['David', 'Joanna'])
	});
	const parse = (rules: unknown[], categories: unknown[] = []) => {
		const out = parseRulesFile(file({ rules, categories }));
		if (!out.ok) throw new Error(out.error);
		return out.file;
	};

	it('classifies new, identical (priority alone is ignored), conflicts, missing categories and invalid', () => {
		const plan = planImport(
			parse(
				[
					rule({ pattern: 'NEW' }),
					rule({ priority: 999 }),
					rule({ pattern: 'CONF', categorySlug: 'supermarket' }),
					rule({ pattern: 'PETFOOD', categorySlug: 'pets' }),
					rule({ pattern: 'GHOST', categorySlug: 'ghost' }),
					rule({ pattern: 'WHO', person: 'Nobody' })
				],
				[cat()]
			),
			local([{}, { pattern: 'CONF' }])
		);
		expect(plan.newRules.map((i) => i.rule.pattern)).toEqual(['NEW']);
		expect(plan.identical.map((i) => i.rule.pattern)).toEqual(['ZZQ']);
		expect(plan.conflicts.map((i) => i.rule.pattern)).toEqual(['CONF']);
		expect(plan.conflicts[0].differences).toEqual(['category shopping → supermarket']);
		expect(plan.missingCategory.map((i) => i.rule.pattern)).toEqual(['PETFOOD']);
		expect(plan.categoriesToCreate.map((c) => c.slug)).toEqual(['pets']);
		expect(plan.invalid.map((i) => i.label)).toEqual(['GHOST', 'WHO']);
	});
});

describe('assignPriorities', () => {
	const r = (pattern: string, priority: number | null): FileRule => ({
		pattern,
		matchType: 'contains',
		direction: 'any',
		categorySlug: 's',
		person: null,
		priority,
		isActive: true
	});
	it('keeps free priorities and appends the rest after the highest, in relative order', () => {
		const rules = [r('a', 20), r('b', 10), r('c', 20), r('d', null), r('e', 5)];
		const out = assignPriorities(rules, [10, 30]);
		const by = Object.fromEntries(out.map((x) => [x.rule.pattern, x.priority]));
		// 10 is taken by an existing rule -> b is appended; a and c may share the free 20
		expect(by.a).toBe(20);
		expect(by.e).toBe(5);
		expect(by.b).toBe(40);
		expect(by.c).toBe(20);
		expect(by.d).toBe(50);
	});
});
