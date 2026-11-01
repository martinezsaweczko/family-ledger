import { expect, test } from '@playwright/test';
import { formatDate } from '../../lib/format/date.ts';
import { formatMoney } from '../../lib/format/money.ts';
import { createDb } from '../../lib/server/db/index.ts';
import { statements } from '../../lib/server/db/schema.ts';
import { todayIso, weekdayOf } from '../../lib/server/manual/schedule.ts';
import { E2E_DATABASE_URL } from '../../../e2e/db.mjs';
import { SYNTHETIC_LAST_BALANCE, seedSynthetic } from '../../../e2e/synthetic.ts';

// Synthetic data only.
const today = todayIso();

test.describe.serial('manual and recurring payments', () => {
	test('adds a one-off payment that shows on the dashboard with a manual badge', async ({
		page
	}) => {
		await seedSynthetic();
		await page.goto('/admin/manual');
		await expect(page.getByRole('link', { name: 'Manual' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(page.getByTestId('double-count-notice')).toContainText('counts it twice');

		const form = page.locator('form[action$="/addEntry"]');
		await form.getByLabel('Amount (EUR)').fill('40');
		await form.getByLabel('Concept').fill('Cleaner cash Zq');
		await form.getByLabel('Category').selectOption({ label: 'Shopping' });
		await form.getByRole('button', { name: 'Add payment' }).click();
		await expect(page.getByRole('status').first()).toContainText('Payment added');

		const row = page.getByTestId('manual-row').filter({ hasText: 'Cleaner cash Zq' });
		await expect(row).toContainText('-40,00 €');
		await expect(row.locator('[data-icon="shopping-bag"]').first()).toBeAttached();

		await page.goto('/dashboard/transactions?range=all&q=Cleaner');
		const tr = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(tr).toContainText('Cleaner cash Zq');
		await expect(tr.getByTestId('badge-manual')).toBeVisible();
		await page.goto('/dashboard?range=all');
		await expect(page.getByTestId('category-list')).toContainText('Shopping');
	});

	test('"adjusts the balance" changes the current balance only when ticked', async ({ page }) => {
		const kpi = page.getByTestId('kpi-balance').locator('[data-kpi-value]');
		await page.goto('/dashboard?range=all');
		// The unticked 40 EUR entry from the previous test must not touch the balance.
		await expect(kpi).toHaveText(formatMoney(SYNTHETIC_LAST_BALANCE()));

		await page.goto('/admin/manual');
		const form = page.locator('form[action$="/addEntry"]');
		await form.getByLabel('Amount (EUR)').fill('15');
		await form.getByLabel('Concept').fill('Paid from account Zq');
		await form.getByLabel(/Paid from the joint account/).check();
		await form.getByRole('button', { name: 'Add payment' }).click();
		await expect(page.getByRole('status').first()).toContainText('Payment added');

		await page.goto('/dashboard?range=all');
		await expect(kpi).toHaveText(formatMoney(SYNTHETIC_LAST_BALANCE() - 1500));
	});

	test('a recurring payment is generated, listed, paused and resumed', async ({ page }) => {
		await page.goto('/admin/manual');
		const form = page.locator('form[action$="/addRecurring"]');
		await form.getByLabel('Weekday').selectOption(String(weekdayOf(today)));
		await form.getByLabel('Amount (EUR)').fill('40');
		await form.getByLabel('Concept').fill('Weekly cleaner Zq');
		await form.getByLabel('Starts').fill(formatDate(today));
		await form.getByRole('button', { name: 'Add recurring payment' }).click();
		await expect(page.getByRole('status').first()).toContainText('Recurring payment added');

		const rec = page.getByTestId('recurring-row').filter({ hasText: 'Weekly cleaner Zq' });
		await expect(rec).toContainText('Every');
		await expect(rec).toContainText('1 entries created');
		await expect(rec.locator('.pill', { hasText: 'Active' })).toBeVisible();

		await page.goto('/dashboard/transactions?range=all&q=Weekly+cleaner');
		const tr = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(tr).toContainText('Weekly cleaner Zq');
		await expect(tr.getByTestId('badge-manual')).toBeVisible();

		await page.goto('/admin/manual');
		await rec.getByRole('button', { name: 'Pause Weekly cleaner Zq' }).click();
		await expect(page.getByRole('status').first()).toContainText('paused');
		await expect(rec.locator('.pill', { hasText: 'Paused' })).toBeVisible();
		await rec.getByRole('button', { name: 'Resume Weekly cleaner Zq' }).click();
		await expect(rec.locator('.pill', { hasText: 'Active' })).toBeVisible();
	});

	test('imported rows can never be edited or deleted from the manual area', async ({
		page,
		request
	}) => {
		await page.goto('/admin/manual?q=TARJETA');
		await expect(page.getByText('No manual entries match.')).toBeVisible();

		const h = createDb(E2E_DATABASE_URL);
		const [imported] = await h.db.select().from(statements).limit(1);
		await h.pool.end();
		const origin = { origin: 'http://localhost:4173' };
		const edit = await request.post('/admin/manual?/updateEntry', {
			headers: origin,
			form: {
				id: String(imported.id),
				bookingDate: '2026-01-01',
				amount: '1',
				direction: 'out',
				concept: 'Tampered'
			}
		});
		expect(await edit.text()).toContain('Manual entry not found');
		const del = await request.post('/admin/manual?/deleteEntry', {
			headers: origin,
			form: { id: String(imported.id) }
		});
		expect(await del.text()).toContain('Manual entry not found');

		await page.goto('/dashboard/transactions?range=all&q=NETFLIX');
		const first = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(first.getByTestId('badge-manual')).toHaveCount(0);
		await expect(page.getByRole('link', { name: /Edit/ })).toHaveCount(0);
	});

	test('deleting a recurring payment removes it and keeps history', async ({ page }) => {
		await page.goto('/admin/manual');
		const rec = page.getByTestId('recurring-row').filter({ hasText: 'Weekly cleaner Zq' });
		await rec.getByText('Delete Weekly cleaner Zq').click();
		await rec.getByRole('button', { name: /Delete recurring payment/ }).click();
		await expect(page.getByRole('status').first()).toContainText('Recurring payment deleted');
		await expect(page.getByTestId('recurring-row')).toHaveCount(0);
		await expect(
			page.getByTestId('manual-row').filter({ hasText: 'Weekly cleaner Zq' })
		).toHaveCount(1);
	});
});
