import { expect, test } from '@playwright/test';
import { buildDbXls } from '../../lib/server/importers/test-fixtures.ts';

// Synthetic data only: fake IBAN (test-fixtures) and invented merchants.
const file = {
	name: 'e2e-movements.xls',
	mimeType: 'application/vnd.ms-excel',
	buffer: buildDbXls([
		{
			date: '12/03/2026',
			valueDate: '12/03/2026',
			concept: 'TARJETA-ZZQ E2E WIDGETS 111',
			amount: -12.5,
			balance: 900
		},
		{
			date: '11/03/2026',
			valueDate: '11/03/2026',
			concept: 'TARJETA-ZZQ E2E WIDGETS 222',
			amount: -7.25,
			balance: 912.5
		},
		{
			date: '10/03/2026',
			valueDate: '10/03/2026',
			concept: 'TARJETA-QQX E2E CAFE',
			amount: -3,
			balance: 919.75
		}
	])
};

test.describe.serial('admin', () => {
	test('imports a synthetic file and reports 0 inserted on re-upload', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByRole('heading', { name: 'Import statements' })).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();

		await page.getByLabel(/Drop bank files here/).setInputFiles(file);
		await page.getByRole('button', { name: 'Import files' }).click();
		const card = page.getByRole('article', { name: 'Result for e2e-movements.xls' });
		await expect(card).toBeVisible();
		await expect(card.locator('[data-stat="Rows"]')).toHaveText('3');
		await expect(card.locator('[data-stat="Inserted"]')).toHaveText('3');
		await expect(card.locator('[data-stat="Uncategorised"]')).toHaveText('3');
		await expect(card).toContainText('deutsche-bank-xls');
		await expect(card).not.toContainText('ES0000000000000000000000');

		await page
			.getByLabel(/Drop bank files here/)
			.setInputFiles([
				file,
				{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a statement') }
			]);
		await page.getByRole('button', { name: 'Import files' }).click();
		const again = page.getByRole('article', { name: 'Result for e2e-movements.xls' });
		await expect(again.locator('[data-stat="Inserted"]')).toHaveText('0');
		await expect(again.locator('[data-stat="Unchanged"]')).toHaveText('3');
		await expect(page.getByRole('article', { name: 'Error for notes.txt' })).toContainText(
			'Could not recognise the format'
		);

		await expect(page.getByRole('table')).toContainText('e2e-movements.xls');
		await expect(page.getByText('Deutsche Bank')).toBeVisible();
	});

	test('assigns a category in review and creates a rule for similar rows', async ({ page }) => {
		await page.goto('/admin/review?q=ZZQ');
		const rows = page.getByTestId('review-row');
		await expect(rows).toHaveCount(2);

		const first = rows.first();
		await first.getByRole('combobox').selectOption({ label: 'Shopping' });
		await first.getByLabel('Also create a rule').check();
		await expect(first.getByLabel(/Rule pattern/)).toHaveValue('ZZQ E2E WIDGETS');
		await first.getByRole('button', { name: 'Save' }).click();

		await expect(page.getByRole('status')).toContainText('1 more row was categorised');
		await expect(page.getByTestId('review-row')).toHaveCount(0);
		await expect(page.getByText('No uncategorised movements match')).toBeVisible();

		await page.goto('/admin/rules?test=ZZQ+E2E');
		await expect(page.getByText('2 statements match')).toBeVisible();
	});

	test('admin pages load', async ({ page }) => {
		for (const [path, heading] of [
			['/admin/categories', 'Categories'],
			['/admin/rules', 'Rules']
		]) {
			await page.goto(path);
			await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		}
	});
});
