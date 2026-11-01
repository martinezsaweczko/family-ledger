import { expect, test } from '@playwright/test';
import { formatMoney } from '../lib/format/money.ts';
import { SYNTHETIC_LAST_BALANCE, seedSynthetic } from '../../e2e/synthetic.ts';

test.describe.serial('landing page (synthetic data)', () => {
	test('empty database: invites an import and labels the sample chart', async ({ page }) => {
		await seedSynthetic(undefined, []);
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.getByTestId('landing-empty')).toContainText('Import your first statement');
		await expect(page.getByText('Sample illustration, not your data')).toBeVisible();
		await expect(page.getByTestId('landing-chart').locator('svg')).toBeVisible();
	});

	test('shows live numbers, the chart and working calls to action', async ({ page }) => {
		await seedSynthetic();
		await page.goto('/');
		await expect(page.getByTestId('live-balance')).toHaveText(
			formatMoney(SYNTHETIC_LAST_BALANCE())
		);
		await expect(page.getByTestId('live-income')).toHaveText(formatMoney(400_000));
		await expect(page.getByTestId('live-rate')).toContainText('%');
		await expect(page.getByText('Sample illustration, not your data')).toHaveCount(0);
		await expect(page.getByTestId('landing-chart').locator('rect').first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Smart de-duplication' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await page.getByRole('main').getByRole('link', { name: 'Open the dashboard' }).first().click();
		await expect(page).toHaveURL(/\/dashboard$/);
	});
});
