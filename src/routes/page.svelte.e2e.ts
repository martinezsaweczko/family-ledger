import { expect, test } from '@playwright/test';

test('home shows the headline and summary cards', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Summary' }).locator('article')).toHaveCount(3);
});
