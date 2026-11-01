import { expect, test } from '@playwright/test';
import { seedSynthetic } from '../../../e2e/synthetic.ts';

// Synthetic data only.
test.describe('category picker in the filter bar', () => {
	test('closes after Apply and "All categories" clears the selection', async ({ page }) => {
		await seedSynthetic();
		await page.goto('/dashboard?range=all');
		const picker = page.locator('details', { hasText: 'All categories' });
		await picker.locator('summary').click();
		await expect(picker).toHaveAttribute('open', '');
		await expect(picker.getByLabel('All categories')).toBeChecked();

		await picker.getByLabel('Supermarket').check();
		await expect(picker.getByLabel('All categories')).not.toBeChecked();
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).toHaveURL(/cat=\d+/);
		await expect(picker).not.toHaveAttribute('open', '');
		await expect(picker.locator('summary')).toContainText('Supermarket');

		await picker.locator('summary').click();
		await picker.getByLabel('All categories').check();
		await expect(picker.getByLabel('Supermarket')).not.toBeChecked();
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).not.toHaveURL(/cat=/);
		await expect(picker.locator('summary')).toContainText('All categories');
	});
});
