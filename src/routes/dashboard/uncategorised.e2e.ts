import { expect, test, type Page } from '@playwright/test';
import { seedSynthetic, syntheticStatements } from '../../../e2e/synthetic.ts';

// Synthetic data only. The synthetic household has one uncategorised charge per month (9).
const rowsOf = (page: Page) => page.getByTestId('transactions-table').locator('tbody tr');

async function pickUncategorised(page: Page) {
	await page.locator('summary', { hasText: 'All categories' }).click();
	await page.getByLabel('Uncategorised', { exact: true }).check();
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
}

test.describe.serial('fix uncategorised transactions faster', () => {
	test.afterAll(async () => {
		await seedSynthetic();
	});

	test('the category filter has an Uncategorised option; only those rows show, with a count', async ({
		page
	}) => {
		await seedSynthetic();
		await page.goto('/dashboard/transactions?range=all');
		await pickUncategorised(page);
		await expect(page).toHaveURL(/uncategorised=1/);
		await expect(rowsOf(page)).toHaveCount(9);
		for (const row of await rowsOf(page).all()) await expect(row).toContainText('Uncategorised');
		await expect(page.getByTestId('uncategorised-count')).toContainText('9 left to categorise');
		await expect(page.locator('summary', { hasText: 'Uncategorised' })).toBeVisible();
		await page.getByRole('link', { name: 'Clear filters' }).click();
		await expect(page).not.toHaveURL(/uncategorised/);
		await expect(page.getByTestId('uncategorised-count')).toContainText(
			'9 uncategorised in this period'
		);
	});

	test('legacy category URLs still work and the badge links to the filtered view', async ({
		page
	}) => {
		await page.goto('/dashboard/transactions?range=all&cat=999999');
		await expect(page.getByTestId('transactions-table')).toBeVisible();
		await page.goto('/dashboard/transactions?range=all&sort=amount_asc');
		await page.getByTestId('uncategorised-count').getByRole('link').click();
		await expect(page).toHaveURL(/uncategorised=1/);
		await expect(page).toHaveURL(/range=all/);
		await expect(page).toHaveURL(/sort=amount_asc/);
		await expect(rowsOf(page)).toHaveCount(9);
	});

	test('the Source select narrows by origin and lives in the URL', async ({ page }) => {
		await page.goto('/dashboard/transactions?range=all');
		await page.getByLabel('Source').selectOption('attention');
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).toHaveURL(/source=attention/);
		await expect(rowsOf(page)).toHaveCount(9); // uncategorised + (no AI rows yet)

		await page.goto('/dashboard/transactions?range=all&source=mine');
		await expect(page.getByLabel('Source')).toHaveValue('mine');
		await expect(page.getByText('No transactions match.')).toBeVisible();

		await page.goto('/dashboard/transactions?range=all&source=rule&q=NETFLIX');
		await expect(rowsOf(page).first()).toContainText('NETFLIX');
		await page.goto('/dashboard/transactions?range=all&source=manual');
		await expect(page.getByText('No transactions match.')).toBeVisible();
	});

	test('changing a category in the filtered view refreshes in place and keeps the keyboard where it was', async ({
		page
	}) => {
		await page.goto('/dashboard/transactions?range=all&uncategorised=1&sort=amount_asc');
		const first = rowsOf(page).first();
		const firstText = await first.innerText();
		await first.getByRole('button', { name: /Change category/ }).click();
		const editor = page.getByTestId('row-editor');
		await editor.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
		await editor.getByRole('button', { name: 'Save category' }).click();

		await expect(page.getByRole('status').filter({ hasText: 'Category changed' })).toBeVisible();
		await expect(rowsOf(page)).toHaveCount(8);
		await expect(page.getByTestId('uncategorised-count')).toContainText('8 left');
		expect(await rowsOf(page).first().innerText()).not.toBe(firstText);
		await expect(page).toHaveURL(/uncategorised=1/);
		await expect(page).toHaveURL(/sort=amount_asc/);
		await expect(page).toHaveURL(/range=all/);
		// focus moved to the Change category control of the row that took its place
		await expect(
			rowsOf(page)
				.first()
				.getByRole('button', { name: /Change category/ })
		).toBeFocused();
	});

	test('emptying the last page goes back to the previous one', async ({ page }) => {
		const extra = Array.from({ length: 17 }, (_, i) => ({
			date: `2026-03-${String(10 + (i % 10)).padStart(2, '0')}`,
			concept: `TARJETA-EXTRA ZQ ${i}`,
			cents: -1000 - i
		}));
		await seedSynthetic(undefined, [...syntheticStatements(), ...extra]); // 9 + 17 = 26 uncategorised
		await page.goto('/dashboard/transactions?range=all&uncategorised=1&page=2');
		await expect(rowsOf(page)).toHaveCount(1);
		await rowsOf(page)
			.first()
			.getByRole('button', { name: /Change category/ })
			.click();
		await page
			.getByTestId('row-editor')
			.getByLabel('Category', { exact: true })
			.selectOption({ label: 'Shopping' });
		await page.getByTestId('row-editor').getByRole('button', { name: 'Save category' }).click();
		await expect(page).not.toHaveURL(/page=2/);
		await expect(page).toHaveURL(/uncategorised=1/);
		await expect(rowsOf(page)).toHaveCount(25);
		await expect(page.getByTestId('uncategorised-count')).toContainText('25 left');
	});

	test('the dashboard banner and the Uncategorised row link to the filtered explorer', async ({
		page
	}) => {
		await seedSynthetic();
		await page.goto('/dashboard?range=all');
		const banner = page.getByTestId('uncategorised-banner');
		await expect(banner).toContainText('9 transactions');
		await banner.getByTestId('fix-uncategorised').click();
		await expect(page).toHaveURL(/\/dashboard\/transactions\?.*uncategorised=1/);
		await expect(page).toHaveURL(/range=all/);
		await expect(rowsOf(page)).toHaveCount(9);

		await page.goto('/dashboard?range=all');
		await page.getByTestId('category-list').getByRole('link', { name: 'Uncategorised' }).click();
		await expect(page).toHaveURL(/uncategorised=1/);
	});

	test('breakdown keeps an Uncategorised bucket so the totals add up', async ({ page }) => {
		await page.goto('/dashboard?range=all');
		await expect(page.getByTestId('category-list')).toContainText('Uncategorised');
	});

	test('shows a positive empty state when nothing is uncategorised', async ({ page }) => {
		await seedSynthetic(
			undefined,
			syntheticStatements().filter((r) => r.category)
		);
		await page.goto('/dashboard/transactions?range=all&uncategorised=1');
		const empty = page.getByTestId('all-caught-up');
		await expect(empty).toContainText('All caught up');
		await empty.getByRole('link', { name: 'Show all transactions' }).click();
		await expect(page).not.toHaveURL(/uncategorised/);
		expect(await rowsOf(page).count()).toBeGreaterThan(20);
	});
});
