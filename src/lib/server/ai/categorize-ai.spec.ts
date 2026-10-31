import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { accounts, categories, categoryRules, importBatches, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { recategorizeAll } from '../categorizer-service.ts';
import { acceptAiCategory, changeCategory } from '../admin/overrides.ts';
import { importFile } from '../importers/import-service.ts';
import { buildDbXls } from '../importers/test-fixtures.ts';
import { acceptAnswer, categorizeWithAi, groupRows } from './categorize-ai.ts';
import type { AiConfig } from './config.ts';
import { testAiConnection } from './status.ts';

const config: AiConfig = {
	baseUrl: 'https://ai.example.test',
	model: 'test-model',
	timeoutMs: 500,
	minConfidence: 0.6
};

/** A fake OpenAI endpoint: `answer` maps a request's items to the answers to return. */
type Item = { id: number; text: string; direction: string; amount: number };
function fakeAi(answer: (items: Item[], prompt: string) => unknown) {
	const calls: { prompt: string; items: Item[] }[] = [];
	const fn = vi.fn(async (_url: string, init: RequestInit) => {
		const body = JSON.parse(init.body as string);
		const prompt: string = body.messages[0].content;
		const items = prompt
			.split('\n')
			.filter((l) => /^\d+ \| .* \| (in|out) \| \d+$/.test(l))
			.map((l) => {
				const [id, text, direction, amount] = l.split(' | ');
				return { id: Number(id), text, direction, amount: Number(amount) };
			});
		calls.push({ prompt, items });
		const out = answer(items, prompt);
		return Response.json({ choices: [{ message: { content: JSON.stringify(out) } }] });
	});
	return { fetch: fn as unknown as typeof fetch, calls, fn };
}

let handle: DbHandle | null = null;
let accountId = 0;
let batchId = 0;
let seq = 0;

beforeAll(async () => {
	handle = await setupTestDb('ai');
	if (!handle) return;
	await handle.db
		.insert(accounts)
		.values({ iban: 'ES0000000000000000000000', name: 'T', currency: 'EUR' });
	const [acc] = await handle.db.select().from(accounts);
	accountId = acc.id;
	const [{ insertId }] = await handle.db
		.insert(importBatches)
		.values({ importerId: 'test', filename: 't.xls', fileSha256: 'a'.repeat(64), accountId });
	batchId = Number(insertId);
}, 60_000);
afterAll(async () => {
	await handle?.pool.end();
});
beforeEach(async () => {
	await handle?.db.delete(statements);
	await handle?.db.delete(categoryRules);
});

async function add(
	concept: string,
	amountCents: number,
	extra: Partial<typeof statements.$inferInsert> = {}
) {
	const [{ insertId }] = await handle!.db.insert(statements).values({
		accountId,
		importerId: 'test',
		dedupHash: createHash('sha256').update(`${seq++}`).digest('hex'),
		bookingDate: '2026-03-01',
		valueDate: '2026-03-01',
		concept,
		amountCents,
		rawJson: {},
		batchId,
		...extra
	});
	return Number(insertId);
}
const row = async (id: number) =>
	(await handle!.db.select().from(statements).where(eq(statements.id, id)))[0];
const catId = async (slug: string) =>
	(await handle!.db.select().from(categories).where(eq(categories.slug, slug)))[0].id;

describe('groupRows / acceptAnswer (pure)', () => {
	it('groups identical cleaned merchants per direction and drops unusable text', () => {
		const { groups, unusable } = groupRows([
			{ id: 1, concept: 'TARJETA-CAFE ZZQ 0001', amountCents: -250 },
			{ id: 2, concept: 'TARJETA-CAFE ZZQ 0002', amountCents: -450 },
			{ id: 3, concept: 'TARJETA-CAFE ZZQ 0003', amountCents: 500 },
			{ id: 4, concept: '12345 6789', amountCents: -100 }
		]);
		expect(unusable).toBe(1);
		expect(groups).toHaveLength(2);
		const out = groups.find((g) => g.direction === 'out')!;
		expect(out.rowIds).toEqual([1, 2]);
		expect(out.amountEuros).toBe(5);
	});
	const bySlug = new Map([
		['food', { id: 1, kind: 'expense' }],
		['pay', { id: 2, kind: 'income' }],
		['move', { id: 3, kind: 'transfer' }]
	]);
	it('applies threshold, unknown slugs and kind mismatch', () => {
		const ans = (category: string | null, confidence: number) => ({ id: 1, category, confidence });
		expect(acceptAnswer(ans('food', 0.59), { direction: 'out' }, bySlug, 0.6)).toBeNull();
		expect(acceptAnswer(ans('food', 0.6), { direction: 'out' }, bySlug, 0.6)).toMatchObject({
			categoryId: 1
		});
		expect(acceptAnswer(ans('nope', 1), { direction: 'out' }, bySlug, 0.6)).toBeNull();
		expect(acceptAnswer(ans(null, 1), { direction: 'out' }, bySlug, 0.6)).toBeNull();
		expect(acceptAnswer(undefined, { direction: 'out' }, bySlug, 0.6)).toBeNull();
		// outgoing money never becomes income
		expect(acceptAnswer(ans('pay', 1), { direction: 'out' }, bySlug, 0.6)).toBeNull();
		// incoming: income/transfer fine, expense only as a confident refund
		expect(acceptAnswer(ans('pay', 0.7), { direction: 'in' }, bySlug, 0.6)).toMatchObject({
			categoryId: 2
		});
		expect(acceptAnswer(ans('move', 0.7), { direction: 'in' }, bySlug, 0.6)).toMatchObject({
			categoryId: 3
		});
		expect(acceptAnswer(ans('food', 0.79), { direction: 'in' }, bySlug, 0.6)).toBeNull();
		expect(acceptAnswer(ans('food', 0.8), { direction: 'in' }, bySlug, 0.6)).toMatchObject({
			categoryId: 1
		});
	});
});

describe('categorizeWithAi (needs local MySQL)', () => {
	it('is disabled without config and touches nothing', async (ctx) => {
		if (!handle) return ctx.skip();
		const id = await add('TARJETA-CAFE ZZQ', -300);
		const spy = vi.fn();
		const res = await categorizeWithAi({ config: null, fetch: spy as never, db: handle.db });
		expect(res).toEqual({ enabled: false, requested: 0, categorised: 0, skipped: 0, failed: 0 });
		expect(spy).not.toHaveBeenCalled();
		expect((await row(id)).categoryId).toBeNull();
	});

	it('asks once per distinct merchant, fans the answer out and stores source/confidence/model', async (ctx) => {
		if (!handle) return ctx.skip();
		const ids = [
			await add('TARJETA-CAFE ZZQ 0001', -250),
			await add('TARJETA-CAFE ZZQ 0002', -350),
			await add('TARJETA-CAFE ZZQ 0003', -450)
		];
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: 'eating-out', confidence: 0.82 }))
		);
		const res = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		expect(ai.calls).toHaveLength(1);
		expect(ai.calls[0].items).toHaveLength(1);
		expect(ai.calls[0].items[0]).toMatchObject({ text: 'CAFE ZZQ', direction: 'out', amount: 4 });
		expect(res).toEqual({ enabled: true, requested: 3, categorised: 3, skipped: 0, failed: 0 });
		const eating = await catId('eating-out');
		for (const id of ids) {
			expect(await row(id)).toMatchObject({
				categoryId: eating,
				categorySource: 'ai',
				aiConfidence: 82,
				aiModel: 'test-model'
			});
		}
	});

	it('never sends digits, IBANs, dates or names in the request', async (ctx) => {
		if (!handle) return ctx.skip();
		await add('TARJETA-MERCADONA 55512 ES9121000418450200051332 REF 99887766', -5146);
		await add('TRF.EX NOMINA DE JANE FAKEPERSON 2026-03-01', 240000);
		const ai = fakeAi(() => []);
		await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		const prompt = ai.calls[0].prompt;
		expect(prompt).not.toMatch(/ES91|55512|99887766|JANE|FAKEPERSON|2026|0000000000/i);
		const request = (ai.fn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
		expect(request).not.toMatch(/ES0000000000000000000000/);
	});

	it('applies the confidence threshold, unknown slugs and kind mismatch; leaves those rows uncategorised', async (ctx) => {
		if (!handle) return ctx.skip();
		const good = await add('TARJETA-ALPHA SHOP', -1000);
		const low = await add('TARJETA-BETA SHOP', -1000);
		const unknown = await add('TARJETA-GAMMA SHOP', -1000);
		const wrongKind = await add('TARJETA-DELTA SHOP', -1000);
		const refund = await add('DEVOLUCION EPSILON SHOP', 1500);
		const answers: Record<string, [string | null, number]> = {
			'ALPHA SHOP': ['shopping', 0.9],
			'BETA SHOP': ['shopping', 0.3],
			'GAMMA SHOP': ['made-up-slug', 0.99],
			'DELTA SHOP': ['salary-contributions', 0.99],
			'DEVOLUCION EPSILON SHOP': ['shopping', 0.85]
		};
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: answers[i.text][0], confidence: answers[i.text][1] }))
		);
		const res = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		expect(res).toMatchObject({ requested: 5, categorised: 2, skipped: 3, failed: 0 });
		expect((await row(good)).categorySource).toBe('ai');
		expect((await row(refund)).categorySource).toBe('ai');
		for (const id of [low, unknown, wrongKind]) {
			expect(await row(id)).toMatchObject({ categoryId: null, categorySource: null });
		}
	});

	it('chunks 45 merchants into 3 requests of at most 20', async (ctx) => {
		if (!handle) return ctx.skip();
		for (let i = 0; i < 45; i++)
			await add(
				`TARJETA-SHOP ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}X`,
				-500
			);
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: 'shopping', confidence: 0.9 }))
		);
		const res = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		expect(ai.calls.map((c) => c.items.length)).toEqual([20, 20, 5]);
		expect(res).toMatchObject({ requested: 45, categorised: 45 });
	});

	it('honours the row bound', async (ctx) => {
		if (!handle) return ctx.skip();
		for (let i = 0; i < 10; i++) await add(`TARJETA-BOUND ${'ABCDEFGHIJ'[i]}Q`, -500);
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: 'shopping', confidence: 0.9 }))
		);
		const res = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db, maxRows: 4 });
		expect(res).toMatchObject({ requested: 4, categorised: 4 });
	});

	it('HTTP error, timeout, bad JSON: rows untouched, counted as failed, never throws', async (ctx) => {
		if (!handle) return ctx.skip();
		const a = await add('TARJETA-FAILING SHOP', -500);
		const b = await add('TARJETA-FAILING TOO', -500);
		const http = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
		const hang = ((_u: string, init: RequestInit) =>
			new Promise((_r, rej) =>
				init.signal!.addEventListener('abort', () => rej(new Error('abort')))
			)) as unknown as typeof fetch;
		const junk = (async () =>
			Response.json({
				choices: [{ message: { content: 'sorry, no' } }]
			})) as unknown as typeof fetch;
		for (const f of [http, hang, junk]) {
			const res = await categorizeWithAi({
				config: { ...config, timeoutMs: 30 },
				fetch: f,
				db: handle.db
			});
			expect(res).toMatchObject({ enabled: true, requested: 2, categorised: 0, failed: 2 });
		}
		for (const id of [a, b]) expect((await row(id)).categoryId).toBeNull();
	});

	it('stops at the time budget and reports the rest as failed', async (ctx) => {
		if (!handle) return ctx.skip();
		for (let i = 0; i < 25; i++)
			await add(`TARJETA-SLOW ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}Q`, -500);
		const slow = (async () => {
			await new Promise((r) => setTimeout(r, 40));
			return Response.json({ choices: [{ message: { content: '[]' } }] });
		}) as unknown as typeof fetch;
		const res = await categorizeWithAi({ config, fetch: slow, db: handle.db, maxTotalMs: 10 });
		expect(res.requested).toBe(25);
		expect(res.failed).toBeGreaterThan(0);
		expect(res.categorised).toBe(0);
	});

	it('never overwrites manual, rule or already-ai rows', async (ctx) => {
		if (!handle) return ctx.skip();
		const car = await catId('car');
		const manual = await add('TARJETA-SAME MERCHANT', -500, {
			categoryId: car,
			categorySource: 'manual'
		});
		const ruled = await add('TARJETA-SAME MERCHANT', -500, {
			categoryId: car,
			categorySource: 'rule'
		});
		const open = await add('TARJETA-SAME MERCHANT', -500);
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: 'shopping', confidence: 0.9 }))
		);
		const res = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		expect(res.requested).toBe(1);
		expect((await row(manual)).categorySource).toBe('manual');
		expect((await row(ruled)).categorySource).toBe('rule');
		expect((await row(open)).categorySource).toBe('ai');
		const again = await categorizeWithAi({ config, fetch: ai.fetch, db: handle.db });
		expect(again.requested).toBe(0);
	});

	it('does not clobber a row the user categorised while the AI was thinking', async (ctx) => {
		if (!handle) return ctx.skip();
		const id = await add('TARJETA-RACE SHOP', -500);
		const car = await catId('car');
		const ai = fakeAi((items) => {
			return items.map((i) => ({ id: i.id, category: 'shopping', confidence: 0.9 }));
		});
		const racing = (async (u: string, init: RequestInit) => {
			await handle!.db
				.update(statements)
				.set({ categoryId: car, categorySource: 'manual' })
				.where(eq(statements.id, id));
			return ai.fetch(u, init);
		}) as unknown as typeof fetch;
		const res = await categorizeWithAi({ config, fetch: racing, db: handle.db });
		expect(res.categorised).toBe(0);
		expect(await row(id)).toMatchObject({ categoryId: car, categorySource: 'manual' });
	});
});

describe('precedence: manual > rule > ai > uncategorised (needs local MySQL)', () => {
	it('recategorizeAll keeps ai rows no rule matches and lets a matching rule replace an ai row', async (ctx) => {
		if (!handle) return ctx.skip();
		const shopping = await catId('shopping');
		const supermarket = await catId('supermarket');
		const kept = await add('TARJETA-PLAIN THING', -500, {
			categoryId: shopping,
			categorySource: 'ai',
			aiConfidence: 70,
			aiModel: 'm'
		});
		const replaced = await add('TARJETA-RULED THING', -500, {
			categoryId: shopping,
			categorySource: 'ai',
			aiConfidence: 70,
			aiModel: 'm'
		});
		await handle.db.insert(categoryRules).values({
			pattern: 'RULED THING',
			matchType: 'contains',
			categoryId: supermarket,
			priority: 100,
			direction: 'any'
		});
		await recategorizeAll(handle.db);
		expect(await row(kept)).toMatchObject({
			categorySource: 'ai',
			categoryId: shopping,
			aiConfidence: 70
		});
		expect(await row(replaced)).toMatchObject({
			categorySource: 'rule',
			categoryId: supermarket,
			aiConfidence: null,
			aiModel: null
		});
	});

	it('a manual change or Accept turns ai into manual and clears the ai fields', async (ctx) => {
		if (!handle) return ctx.skip();
		const shopping = await catId('shopping');
		const car = await catId('car');
		const a = await add('TARJETA-ACCEPT ME', -500, {
			categoryId: shopping,
			categorySource: 'ai',
			aiConfidence: 66,
			aiModel: 'm'
		});
		const b = await add('TARJETA-CHANGE ME', -500, {
			categoryId: shopping,
			categorySource: 'ai',
			aiConfidence: 66,
			aiModel: 'm'
		});
		expect((await acceptAiCategory({ statementId: a }, handle.db)).ok).toBe(true);
		expect(await row(a)).toMatchObject({
			categorySource: 'manual',
			categoryId: shopping,
			aiConfidence: null,
			aiModel: null
		});
		expect((await changeCategory({ statementId: b, categoryId: car }, handle.db)).ok).toBe(true);
		expect(await row(b)).toMatchObject({
			categorySource: 'manual',
			categoryId: car,
			aiConfidence: null
		});
		// a locked row survives recategorizeAll and a later AI run
		await recategorizeAll(handle.db);
		expect((await row(a)).categorySource).toBe('manual');
		const none = await acceptAiCategory({ statementId: a }, handle.db);
		expect(none.ok).toBe(false);
	});

	it('Accept can also create a rule that categorises the same merchant elsewhere', async (ctx) => {
		if (!handle) return ctx.skip();
		const shopping = await catId('shopping');
		const a = await add('TARJETA-LEARN ME', -500, {
			categoryId: shopping,
			categorySource: 'ai',
			aiConfidence: 90,
			aiModel: 'm'
		});
		const other = await add('TARJETA-LEARN ME', -700);
		const res = await acceptAiCategory({ statementId: a, rulePattern: 'LEARN ME' }, handle.db);
		expect(res).toMatchObject({ ok: true, value: { rule: { created: true }, alsoCategorised: 1 } });
		expect((await row(other)).categorySource).toBe('rule');
	});
});

describe('importFile + AI (needs local MySQL)', () => {
	const rows = (n: number, merchant: string) =>
		Array.from({ length: n }, (_, i) => ({
			date: `0${(i % 8) + 1}/03/2026`,
			valueDate: `0${(i % 8) + 1}/03/2026`,
			concept: `TARJETA-${merchant} ${i}`,
			amount: -(10 + i),
			balance: 1000 - i
		}));

	it('categorises only the new uncategorised rows, reports the AI summary, and skips re-imports', async (ctx) => {
		if (!handle) return ctx.skip();
		const ai = fakeAi((items) =>
			items.map((i) => ({ id: i.id, category: 'shopping', confidence: 0.9 }))
		);
		const buffer = buildDbXls(rows(3, 'NOVELTY SHOP'));
		const first = await importFile(
			{ buffer, filename: 'a.xls', ai: { config, fetch: ai.fetch } },
			handle.db
		);
		expect(first.rowsInserted).toBe(3);
		expect(first.ai).toEqual({
			enabled: true,
			requested: 3,
			categorised: 3,
			skipped: 0,
			failed: 0
		});
		const calls = ai.calls.length;
		const second = await importFile(
			{ buffer, filename: 'a.xls', ai: { config, fetch: ai.fetch } },
			handle.db
		);
		expect(second.rowsInserted).toBe(0);
		expect(second.ai.requested).toBe(0);
		expect(ai.calls.length).toBe(calls);
	});

	it('an AI outage never fails or alters the import', async (ctx) => {
		if (!handle) return ctx.skip();
		const down = (async () => {
			throw new Error('connection refused');
		}) as unknown as typeof fetch;
		const res = await importFile(
			{
				buffer: buildDbXls(rows(2, 'OUTAGE SHOP')),
				filename: 'b.xls',
				ai: { config, fetch: down }
			},
			handle.db
		);
		expect(res.rowsInserted).toBe(2);
		expect(res.ai).toMatchObject({ enabled: true, requested: 2, categorised: 0, failed: 2 });
		const left = await handle.db
			.select({ s: statements.categorySource })
			.from(statements)
			.where(inArray(statements.concept, ['TARJETA-OUTAGE SHOP 0', 'TARJETA-OUTAGE SHOP 1']));
		expect(left.every((r) => r.s === null)).toBe(true);
	});

	it('reports disabled when AI is not configured', async (ctx) => {
		if (!handle) return ctx.skip();
		const res = await importFile(
			{ buffer: buildDbXls(rows(1, 'PLAIN SHOP')), filename: 'c.xls', ai: { config: null } },
			handle.db
		);
		expect(res.ai.enabled).toBe(false);
	});
});

describe('testAiConnection', () => {
	it('succeeds on a valid JSON reply and reports odd replies and outages', async () => {
		const good = fakeAi(() => [{ id: 1, category: 'supermarket', confidence: 0.9 }]);
		expect(await testAiConnection(config, good.fetch)).toMatchObject({ ok: true });
		expect(good.calls[0].prompt).toContain('MERCADONA PORT');
		const odd = fakeAi(() => 'hello');
		expect(await testAiConnection(config, odd.fetch)).toMatchObject({ ok: false });
		const down = (async () => new Response('x', { status: 502 })) as unknown as typeof fetch;
		expect(await testAiConnection(config, down)).toMatchObject({
			ok: false,
			message: expect.stringContaining('502')
		});
		expect((await testAiConnection(null)).ok).toBe(false);
	});
});
