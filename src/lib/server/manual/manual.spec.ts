import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, count, eq } from 'drizzle-orm';
import type { DbHandle } from '../db/index.ts';
import { accounts, categories, importBatches, recurringEntries, statements } from '../db/schema.ts';
import { setupTestDb } from '../testing/test-db.ts';
import { clearStatements, seedStatements } from '../analytics/test-seed.ts';
import { categoryBreakdown, dataRange, latestBalance, transactions } from '../analytics/index.ts';
import {
	createManualEntry,
	deleteManualEntry,
	listManualEntries,
	updateManualEntry,
	validateEntry
} from './entries.ts';
import {
	countFutureGenerated,
	createRecurring,
	deleteRecurring,
	endRecurring,
	materialiseRecurring,
	setRecurringActive,
	updateRecurring,
	validateRecurring
} from './recurring.ts';

let handle: DbHandle | null = null;
beforeAll(async () => {
	handle = await setupTestDb('manual');
}, 60_000);
afterAll(async () => {
	await handle?.pool.end();
});
beforeEach(async () => {
	if (!handle) return;
	await clearStatements(handle.db);
	await handle.db.delete(recurringEntries);
	await handle.db.delete(importBatches);
	await handle.db.delete(accounts);
});

const catId = async (h: DbHandle, slug: string) =>
	(await h.db.select().from(categories).where(eq(categories.slug, slug)))[0].id;
const manualRows = async (h: DbHandle, recurringId?: number) =>
	(
		await h.db
			.select()
			.from(statements)
			.where(
				recurringId === undefined
					? eq(statements.importerId, 'manual')
					: eq(statements.recurringId, recurringId)
			)
	).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
const recurringForm = (over: Record<string, string> = {}) => ({
	concept: 'Cleaner',
	amount: '40',
	direction: 'out',
	frequency: 'weekly',
	anchor: '5',
	startDate: '2026-03-01',
	...over
});
const makeRecurring = async (h: DbHandle, over: Record<string, string> = {}) => {
	const res = await createRecurring({ ...recurringForm(over) }, h.db);
	if (!res.ok) throw new Error(JSON.stringify(res.errors));
	return res.value.id;
};

describe('validation (no DB)', () => {
	it('parses amounts, dates and direction for one-off entries', () => {
		const ok = validateEntry({
			bookingDate: '2026-03-06',
			amount: '40,5',
			direction: 'out',
			concept: ' Cleaner ',
			affectsBalance: 'on'
		});
		expect(ok).toMatchObject({
			ok: true,
			value: { amountCents: 4050, concept: 'Cleaner', affectsBalance: true, categoryId: null }
		});
		for (const bad of [
			{ amount: '0' },
			{ amount: '-3' },
			{ amount: 'abc' },
			{ amount: '1.234' },
			{ bookingDate: '2026-02-30' },
			{ concept: '   ' },
			{ direction: 'sideways' }
		]) {
			const res = validateEntry({
				bookingDate: '2026-03-06',
				amount: '10',
				direction: 'out',
				concept: 'x',
				...bad
			});
			expect(res.ok, JSON.stringify(bad)).toBe(false);
		}
	});

	it('validates recurring schedules', () => {
		expect(validateRecurring(recurringForm()).ok).toBe(true);
		expect(validateRecurring(recurringForm({ anchor: '8' })).ok).toBe(false);
		expect(validateRecurring(recurringForm({ frequency: 'monthly', anchor: '31' })).ok).toBe(true);
		expect(validateRecurring(recurringForm({ frequency: 'monthly', anchor: '32' })).ok).toBe(false);
		expect(validateRecurring(recurringForm({ frequency: 'daily' })).ok).toBe(false);
		expect(validateRecurring(recurringForm({ endDate: '2026-02-01' })).ok).toBe(false);
	});
});

describe('manual entries (needs local MySQL)', () => {
	it('creates a one-off entry on the first account, or a synthetic one when none exists', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const input = { bookingDate: '2026-03-06', amount: '40', direction: 'out', concept: 'Cleaner' };
		expect((await createManualEntry(input, h.db)).ok).toBe(true);
		const [acc] = await h.db.select().from(accounts);
		expect(acc.iban).toBe('MANUAL-ENTRIES'); // nothing imported yet -> synthetic account

		await seedStatements(h.db, [{ date: '2026-03-01', concept: 'BANK ROW', cents: -100 }]);
		await createManualEntry(input, h.db);
		const rows = await manualRows(h);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			importerId: 'manual',
			amountCents: -4000,
			balanceCents: null,
			affectsBalance: false,
			rawJson: { manual: true, note: null }
		});
		expect(new Set(rows.map((r) => r.dedupHash)).size).toBe(2);
		expect(rows[0].dedupHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('joins the existing (joint) account when one is already there', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, [{ date: '2026-03-01', concept: 'BANK ROW', cents: -100 }]);
		const [bank] = await h.db.select().from(accounts);
		await createManualEntry(
			{ bookingDate: '2026-03-06', amount: '5', direction: 'in', concept: 'Gift' },
			h.db
		);
		expect((await manualRows(h))[0]).toMatchObject({ accountId: bank.id, amountCents: 500 });
		expect((await h.db.select({ n: count() }).from(accounts))[0].n).toBe(1);
	});

	it('edits and deletes only manual rows, never imported ones', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, [{ date: '2026-03-01', concept: 'BANK ROW', cents: -100 }]);
		const [bankRow] = await h.db.select().from(statements);
		const form = { bookingDate: '2026-03-09', amount: '99', direction: 'out', concept: 'Tampered' };
		const res = await updateManualEntry(bankRow.id, form, h.db);
		expect(res.ok).toBe(false);
		expect(await deleteManualEntry(bankRow.id, h.db)).toBe(false);
		expect(
			(await h.db.select().from(statements).where(eq(statements.id, bankRow.id)))[0]
		).toMatchObject({ concept: 'BANK ROW', amountCents: -100, bookingDate: '2026-03-01' });

		const created = await createManualEntry({ ...form, concept: 'Mine' }, h.db);
		if (!created.ok) throw new Error('create failed');
		expect(
			(await updateManualEntry(created.value.id, { ...form, concept: 'Edited' }, h.db)).ok
		).toBe(true);
		expect((await manualRows(h))[0].concept).toBe('Edited');
		const list = await listManualEntries({ kind: 'oneoff' }, h.db);
		expect(list.total).toBe(1);
		expect(await deleteManualEntry(created.value.id, h.db)).toBe(true);
		expect(await manualRows(h)).toHaveLength(0);
	});

	it('rejects archived or unknown categories', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const res = await createManualEntry(
			{
				bookingDate: '2026-03-06',
				amount: '5',
				direction: 'out',
				concept: 'x',
				categoryId: '99999'
			},
			h.db
		);
		expect(res.ok).toBe(false);
	});
});

describe('recurring materialisation (needs local MySQL)', () => {
	it('weekly: generates every Friday up to the given day and is idempotent', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const cleaning = await catId(h, 'other-income'); // any active category
		const id = await makeRecurring(h, { categoryId: String(cleaning) });
		expect(await materialiseRecurring('2026-03-20', h.db)).toEqual({ inserted: 3 });
		expect((await manualRows(h, id)).map((r) => r.bookingDate)).toEqual([
			'2026-03-06',
			'2026-03-13',
			'2026-03-20'
		]);
		expect((await manualRows(h, id))[0]).toMatchObject({
			amountCents: -4000,
			categoryId: cleaning,
			categorySource: 'manual',
			importerId: 'manual'
		});
		expect(await materialiseRecurring('2026-03-20', h.db)).toEqual({ inserted: 0 });
		expect(await materialiseRecurring('2026-03-25', h.db)).toEqual({ inserted: 0 });
		expect(await materialiseRecurring('2026-04-03', h.db)).toEqual({ inserted: 2 });
		expect(await manualRows(h, id)).toHaveLength(5);
	});

	it('deterministic hashes stop duplicates even if last_generated is lost', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h);
		await materialiseRecurring('2026-03-20', h.db);
		await h.db
			.update(recurringEntries)
			.set({ lastGenerated: null })
			.where(eq(recurringEntries.id, id));
		expect(await materialiseRecurring('2026-03-20', h.db)).toEqual({ inserted: 0 });
		expect(await manualRows(h, id)).toHaveLength(3);
	});

	it('biweekly and monthly with end-of-month clamping', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const bi = await makeRecurring(h, { frequency: 'biweekly' });
		const month = await makeRecurring(h, {
			concept: 'Rent share',
			frequency: 'monthly',
			anchor: '31',
			startDate: '2026-01-15'
		});
		await materialiseRecurring('2026-04-30', h.db);
		expect((await manualRows(h, bi)).map((r) => r.bookingDate)).toEqual([
			'2026-03-06',
			'2026-03-20',
			'2026-04-03',
			'2026-04-17'
		]);
		expect((await manualRows(h, month)).map((r) => r.bookingDate)).toEqual([
			'2026-01-31',
			'2026-02-28',
			'2026-03-31',
			'2026-04-30'
		]);
	});

	it('income direction yields positive amounts', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h, { direction: 'in', amount: '12.5' });
		await materialiseRecurring('2026-03-07', h.db);
		expect((await manualRows(h, id))[0].amountCents).toBe(1250);
	});

	it('an end date stops generation, even later', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h, { endDate: '2026-03-13' });
		await materialiseRecurring('2026-06-30', h.db);
		expect(await manualRows(h, id)).toHaveLength(2);
		await materialiseRecurring('2026-12-31', h.db);
		expect(await manualRows(h, id)).toHaveLength(2);
	});

	it('ending today stops future generation', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h);
		await materialiseRecurring('2026-03-13', h.db);
		expect(await endRecurring(id, '2026-03-14', h.db)).toBe(true);
		await materialiseRecurring('2026-04-30', h.db);
		expect(await manualRows(h, id)).toHaveLength(2);
	});

	it('pausing stops generation and resuming does not backfill the gap', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h);
		await materialiseRecurring('2026-03-13', h.db);
		await setRecurringActive(id, false, '2026-03-14', h.db);
		await materialiseRecurring('2026-04-10', h.db);
		expect(await manualRows(h, id)).toHaveLength(2);
		await setRecurringActive(id, true, '2026-04-10', h.db);
		await materialiseRecurring('2026-04-24', h.db);
		expect((await manualRows(h, id)).map((r) => r.bookingDate)).toEqual([
			'2026-03-06',
			'2026-03-13',
			'2026-04-10',
			'2026-04-17',
			'2026-04-24'
		]);
	});

	it('editing affects only future occurrences; a deleted occurrence stays deleted', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h);
		await materialiseRecurring('2026-03-20', h.db);
		const upd = await updateRecurring(id, recurringForm({ amount: '50' }), h.db);
		expect(upd.ok).toBe(true);
		const [second] = (await manualRows(h, id)).filter((r) => r.bookingDate === '2026-03-13');
		await h.db.delete(statements).where(eq(statements.id, second.id));
		await materialiseRecurring('2026-03-27', h.db);
		const rows = await manualRows(h, id);
		expect(rows.map((r) => [r.bookingDate, r.amountCents])).toEqual([
			['2026-03-06', -4000],
			['2026-03-20', -4000],
			['2026-03-27', -5000]
		]);
	});

	it('deleting offers to also remove generated future entries', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		const id = await makeRecurring(h);
		await materialiseRecurring('2026-03-20', h.db);
		expect(await countFutureGenerated(id, '2026-03-10', h.db)).toBe(2);
		const kept = await deleteRecurring(id, { today: '2026-03-10' }, h.db);
		expect(kept).toEqual({ deleted: true, futureRemoved: 0 });
		const rows = await manualRows(h);
		expect(rows).toHaveLength(3);
		expect(rows.every((r) => r.recurringId === null)).toBe(true);

		const id2 = await makeRecurring(h, { concept: 'Other', startDate: '2026-04-01' });
		await materialiseRecurring('2026-04-24', h.db);
		const gone = await deleteRecurring(id2, { deleteFuture: true, today: '2026-04-10' }, h.db);
		expect(gone).toEqual({ deleted: true, futureRemoved: 2 });
		expect(
			(await h.db.select({ n: count() }).from(statements).where(eq(statements.concept, 'Other')))[0]
				.n
		).toBe(2);
	});
});

describe('balance rule and analytics (needs local MySQL)', () => {
	const bank = (balance = 100_000) => [
		{ date: '2026-03-10', concept: 'BANK ROW', cents: -1000, balance },
		{ date: '2026-03-05', concept: 'OLDER', cents: -1, balance: balance + 1000 }
	];
	const add = (h: DbHandle, date: string, amount: string, flag: boolean, direction = 'out') =>
		createManualEntry(
			{
				bookingDate: date,
				amount,
				direction,
				concept: 'M',
				...(flag ? { affectsBalance: 'on' } : {})
			},
			h.db
		);

	it('adds only flagged manual entries dated after the bank row', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, bank());
		await add(h, '2026-03-12', '40', true); // counts: -4000
		await add(h, '2026-03-13', '15', true, 'in'); // counts: +1500
		await add(h, '2026-03-14', '99', false); // not flagged
		await add(h, '2026-03-10', '77', true); // same day as the bank row: already in its balance
		await add(h, '2026-03-08', '88', true); // before the bank row
		expect(await latestBalance(undefined, h.db)).toEqual({
			cents: 100_000 - 4000 + 1500,
			date: '2026-03-10'
		});
		// Respects the upper bound of the period being looked at.
		expect((await latestBalance('2026-03-12', h.db)).cents).toBe(96_000);
		expect((await latestBalance('2026-03-11', h.db)).cents).toBe(100_000);
	});

	it('is null without any bank balance', async (ctx) => {
		if (!handle) return ctx.skip();
		await add(handle, '2026-03-12', '40', true);
		expect((await latestBalance(undefined, handle.db)).cents).toBeNull();
	});

	it('flows into breakdowns and transaction lists like any other row', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, bank());
		const supermarket = await catId(h, 'supermarket');
		await createManualEntry(
			{
				bookingDate: '2026-03-12',
				amount: '40',
				direction: 'out',
				concept: 'Cleaner',
				categoryId: String(supermarket)
			},
			h.db
		);
		const breakdown = await categoryBreakdown({ from: '2026-03-01', to: '2026-03-31' }, h.db);
		expect(breakdown.expense.find((c) => c.slug === 'supermarket')?.totalCents).toBe(4000);
		const page = await transactions({ from: '2026-03-01', to: '2026-03-31' }, {}, h.db);
		const row = page.rows.find((r) => r.concept === 'Cleaner');
		expect(row).toMatchObject({ isManual: true, categorySource: 'manual', amountCents: -4000 });
		expect(page.rows.find((r) => r.concept === 'BANK ROW')?.isManual).toBe(false);
	});

	it('anchors ranges at the newest non-future row, manual rows included', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		await seedStatements(h.db, bank());
		expect((await dataRange(h.db, '2026-06-30')).maxDate).toBe('2026-03-10');
		await add(h, '2026-05-15', '40', false);
		expect((await dataRange(h.db, '2026-06-30')).maxDate).toBe('2026-05-15');
		await add(h, '2026-09-01', '40', false); // scheduled ahead: must not move the anchor
		const range = await dataRange(h.db, '2026-06-30');
		expect(range.maxDate).toBe('2026-05-15');
		expect(range.count).toBe(4);
	});
});

describe('uniqueness of manual dedup hashes (needs local MySQL)', () => {
	it('never collides between one-offs and recurring rows', async (ctx) => {
		if (!handle) return ctx.skip();
		const h = handle;
		for (let i = 0; i < 5; i++) {
			await createManualEntry(
				{ bookingDate: '2026-03-06', amount: '40', direction: 'out', concept: 'Cleaner' },
				h.db
			);
		}
		await makeRecurring(h);
		await materialiseRecurring('2026-03-20', h.db);
		const hashes = (await manualRows(h)).map((r) => r.dedupHash);
		expect(new Set(hashes).size).toBe(hashes.length);
		expect(hashes).toHaveLength(8);
		expect(
			(
				await h.db
					.select({ n: count() })
					.from(statements)
					.where(and(eq(statements.importerId, 'manual'), eq(statements.concept, 'Cleaner')))
			)[0].n
		).toBe(8);
	});
});
