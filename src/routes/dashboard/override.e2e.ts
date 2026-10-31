import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { createDb } from '../../lib/server/db/index.ts';
import { categoryRules } from '../../lib/server/db/schema.ts';
import { E2E_DATABASE_URL } from '../../../e2e/db.mjs';
import { seedSynthetic } from '../../../e2e/synthetic.ts';

// Synthetic data only.
test.describe.serial('change category per transaction', () => {
	test.afterAll(async () => {
		// Leave no rule behind: later specs expect the synthetic uncategorised rows.
		const h = createDb(E2E_DATABASE_URL);
		await h.db.delete(categoryRules).where(eq(categoryRules.pattern, 'UNKNOWN SHOP QQX'));
		await h.pool.end();
	});

	test('changes a row, keeps the URL state, shows the edited badge and can undo it', async ({
		page
	}) => {
		await seedSynthetic();
		await page.goto('/dashboard/transactions?range=all&q=UNKNOWN&sort=amount_asc');
		const row = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(row).toContainText('Uncategorised');
		await expect(row.getByTestId('badge-edited')).toHaveCount(0);

		await row.getByRole('button', { name: /Change category/ }).click();
		const editor = page.getByTestId('row-editor');
		await editor.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
		await editor.getByRole('button', { name: 'Save category' }).click();

		await expect(page.getByRole('status').filter({ hasText: 'Category changed' })).toBeVisible();
		await expect(page).toHaveURL(/range=all/);
		await expect(page).toHaveURL(/q=UNKNOWN/);
		await expect(page).toHaveURL(/sort=amount_asc/);
		const same = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(same).toContainText('Shopping');
		await expect(same.getByTestId('badge-edited')).toBeVisible();

		await same.getByRole('button', { name: /Change category/ }).click();
		await page
			.getByTestId('row-editor')
			.getByRole('button', { name: /Remove my change/ })
			.click();
		await expect(page.getByRole('status').filter({ hasText: 'change was removed' })).toBeVisible();
		const back = page.getByTestId('transactions-table').locator('tbody tr').first();
		await expect(back).toContainText('Uncategorised');
		await expect(back.getByTestId('badge-edited')).toHaveCount(0);
		await expect(page).toHaveURL(/q=UNKNOWN/);
	});

	test('also create a rule recategorises the other matching rows', async ({ page }) => {
		await seedSynthetic();
		await page.goto('/dashboard/transactions?range=all&q=UNKNOWN');
		const row = page.getByTestId('transactions-table').locator('tbody tr').first();
		await row.getByRole('button', { name: /Change category/ }).click();
		const editor = page.getByTestId('row-editor');
		await editor.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
		await editor.getByLabel('Also create a rule from this').check();
		await expect(editor.getByLabel(/Rule pattern/)).toHaveValue('UNKNOWN SHOP QQX');
		await editor.getByRole('button', { name: 'Save category' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Rule created' })).toContainText(
			'other rows were categorised'
		);
		await expect(page.getByTestId('transactions-table').locator('tbody tr').first()).toContainText(
			'Shopping'
		);
	});

	test('the drill-down page has the control too', async ({ page }) => {
		await page.goto('/dashboard/category/supermarket?range=all');
		await expect(page.getByRole('button', { name: /Change category/ }).first()).toBeVisible();
	});
});
