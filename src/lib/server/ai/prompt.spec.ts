import { describe, expect, it } from 'vitest';
import { buildPrompt, parseAiReply, sanitizeConcept } from './prompt.ts';

describe('sanitizeConcept (privacy)', () => {
	it('drops every digit and IBAN-like token', () => {
		const out = sanitizeConcept('MERCADONA 1234 REF 99887766 ES9121000418450200051332', 'out');
		expect(out).not.toMatch(/\d/);
		expect(out).toBe('MERCADONA REF');
	});
	it('drops the sender name of incoming transfers', () => {
		expect(sanitizeConcept('TRF.EX NOMINA DE FAKE PERSON', 'in')).toBe('TRF.EX NOMINA');
		expect(sanitizeConcept('CAFE DE LA PLAZA', 'out')).toBe('CAFE DE LA PLAZA');
	});
	it('collapses noise and caps the length', () => {
		expect(sanitizeConcept('  A **** B // C  ', 'out')).toBe('A B C');
		expect(sanitizeConcept('X'.repeat(200), 'out')).toHaveLength(60);
	});
});

describe('buildPrompt', () => {
	const cats = [
		{ slug: 'supermarket', name: 'Supermarket', kind: 'expense' },
		{ slug: 'salary-contributions', name: 'Salary & contributions', kind: 'income' }
	];
	const prompt = buildPrompt(cats, [
		{ id: 1, text: 'MERCADONA PORT', direction: 'out', amountEuros: 51 },
		{ id: 2, text: 'NOMINA', direction: 'in', amountEuros: 2400 }
	]);

	it('lists categories and items and demands strict JSON', () => {
		expect(prompt).toContain('supermarket | Supermarket | expense');
		expect(prompt).toContain('1 | MERCADONA PORT | out | 51');
		expect(prompt).toContain('2 | NOMINA | in | 2400');
		expect(prompt).toMatch(/ONLY with a JSON array/);
		expect(prompt).toContain('"category"');
		expect(prompt).toContain('null');
	});
	it('contains no dates, IBAN or balance wording, and no stray digits beyond ids and amounts', () => {
		expect(prompt).not.toMatch(/iban|balance|account|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/i);
		const itemLines = prompt.split('Items')[1].split('\n').slice(1);
		for (const line of itemLines) expect(line).toMatch(/^\d+ \| [^|\d]*\| (in|out) \| \d+$/);
	});
	it('keeps a name with a newline on one line', () => {
		const p = buildPrompt([{ slug: 'x', name: 'A\nB', kind: 'expense' }], []);
		expect(p).toContain('x | A B | expense');
	});
});

describe('parseAiReply', () => {
	it('parses a clean array', () => {
		expect(parseAiReply('[{"id":1,"category":"supermarket","confidence":0.9}]')).toEqual([
			{ id: 1, category: 'supermarket', confidence: 0.9 }
		]);
	});
	it('tolerates markdown fences and prose', () => {
		const reply =
			'Sure! Here you go:\n```json\n[{"id":1,"category":"Supermarket","confidence":0.8}]\n```\nHope it helps.';
		expect(parseAiReply(reply)).toEqual([{ id: 1, category: 'supermarket', confidence: 0.8 }]);
		expect(parseAiReply('Result: [{"id":2,"category":null,"confidence":0.1}] done')).toEqual([
			{ id: 2, category: null, confidence: 0.1 }
		]);
	});
	it('accepts an object wrapper, string ids and percent confidences', () => {
		expect(parseAiReply('{"results":[{"id":"3","category":"car","confidence":85}]}')).toEqual([
			{ id: 3, category: 'car', confidence: 0.85 }
		]);
	});
	it('clamps out-of-range confidence and defaults a missing one to 0', () => {
		const got = parseAiReply(
			'[{"id":1,"category":"a","confidence":700},{"id":2,"category":"b","confidence":-3},{"id":3,"category":"c"}]'
		);
		expect(got.map((g) => g.confidence)).toEqual([1, 0, 0]);
	});
	it('skips malformed elements and duplicate ids', () => {
		const got = parseAiReply(
			'[1,"x",null,{"category":"a"},{"id":1.5},{"id":1,"category":"a","confidence":1},{"id":1,"category":"b","confidence":1}]'
		);
		expect(got).toEqual([{ id: 1, category: 'a', confidence: 1 }]);
	});
	it('never throws on garbage', () => {
		for (const bad of ['', 'nope', '[{', '{"a":1}', '```', 'null', '42', '[[[']) {
			expect(() => parseAiReply(bad), bad).not.toThrow();
			expect(parseAiReply(bad)).toEqual([]);
		}
	});
});
