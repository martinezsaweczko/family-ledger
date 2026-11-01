import { expect, test } from '@playwright/test';
import { formatMoney } from '../../lib/format/money.ts';
import {
	SYNTHETIC_LAST_BALANCE,
	seedSynthetic,
	syntheticStatements
} from '../../../e2e/synthetic.ts';

// Everything here runs on the SYNTHETIC dataset (fake merchants, fake names, fake IBAN).
const rows = syntheticStatements();
const spend = (from: string, withTransfers = false) =>
	rows
		.filter(
			(r) => r.date >= from && r.cents < 0 && (withTransfers || r.category !== 'internal-transfer')
		)
		.reduce((n, r) => n - r.cents, 0);

const kpi = (page: import('@playwright/test').Page, id: string) =>
	page.getByTestId(`kpi-${id}`).locator('[data-kpi-value]');

test.describe.serial('dashboard', () => {
	test('shows a friendly empty state linking to admin when there is no data', async ({ page }) => {
		await seedSynthetic(undefined, []);
		await page.goto('/dashboard');
		await expect(page.getByTestId('empty-state')).toContainText('No statements yet');
		await page.getByRole('link', { name: 'Import a statement' }).click();
		await expect(page).toHaveURL(/\/admin$/);
	});

	test('KPIs, charts, banner and recurring list render from the data', async ({ page }) => {
		await seedSynthetic();
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await page.goto('/dashboard');

		await expect(page.getByTestId('range-caption')).toHaveText('01/10/2025 to 26/03/2026');
		await expect(kpi(page, 'income')).toHaveText(formatMoney(2_400_000));
		await expect(kpi(page, 'expenses')).toHaveText(formatMoney(spend('2025-10-01')));
		await expect(kpi(page, 'balance')).toHaveText(formatMoney(SYNTHETIC_LAST_BALANCE()));
		await expect(page.getByTestId('kpi-savings-rate')).toContainText('%');
		await expect(page.getByTestId('kpi-expenses')).toContainText('vs previous');

		await expect(page.locator('[data-chart-ready="true"]')).toHaveCount(6);
		for (const id of ['flow', 'categories', 'merchants', 'trend', 'people', 'balance']) {
			await expect(page.getByTestId(`chart-${id}`).locator('svg').first()).toBeVisible();
		}
		await expect(page.getByRole('img', { name: /Income, expenses and net saved/ })).toBeVisible();
		// Data-table fallback for assistive tech
		await expect(page.locator('table.sr-only, div.sr-only table').first()).toBeAttached();

		const banner = page.getByTestId('uncategorised-banner');
		await expect(banner).toContainText('6 transactions');
		await expect(banner.getByRole('link', { name: 'Review queue' })).toHaveAttribute(
			'href',
			/\/admin\/review$/
		);

		await expect(page.getByTestId('recurring-list')).toContainText('NETFLIX');
		await expect(page.getByTestId('recurring-list')).toContainText('SPOTIFY');
		await expect(page.getByTestId('people-list')).toContainText('David');
		await expect(page.getByTestId('people-list')).toContainText('Joanna');
		await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(errors).toEqual([]);
	});

	test('filters live in the URL and change the data', async ({ page }) => {
		await page.goto('/dashboard');
		await page.getByRole('link', { name: 'Last 3 months' }).click();
		await expect(page).toHaveURL(/range=3m/);
		await expect(kpi(page, 'income')).toHaveText(formatMoney(1_200_000));
		await expect(page.getByRole('link', { name: 'Last 3 months' })).toHaveAttribute(
			'aria-current',
			'true'
		);

		await page.getByLabel('Group by', { exact: true }).selectOption('week');
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).toHaveURL(/range=3m/);
		await expect(page).toHaveURL(/g=week/);

		// DateInput only renders its calendar button after hydration; typing earlier is overwritten.
		await expect(page.getByRole('button', { name: 'Open calendar' }).first()).toBeVisible();
		await page.getByLabel('From', { exact: true }).fill('01/02/2026');
		await page.getByLabel('To', { exact: true }).fill('28/02/2026');
		await page.getByRole('button', { name: 'Apply dates' }).click();
		await expect(page).toHaveURL(/from=2026-02-01/);
		await expect(page).toHaveURL(/to=2026-02-28/);
		await expect(kpi(page, 'income')).toHaveText(formatMoney(400_000));

		await page.goBack();
		await expect(page).toHaveURL(/range=3m/);
	});

	test('include transfers and the category picker change what is counted', async ({ page }) => {
		await page.goto('/dashboard?range=3m');
		const before = await kpi(page, 'expenses').innerText();
		await page.getByLabel('Include transfers').check();
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).toHaveURL(/transfers=1/);
		await expect(kpi(page, 'expenses')).toHaveText(formatMoney(spend('2026-01-01', true)));
		expect(await kpi(page, 'expenses').innerText()).not.toBe(before);

		await page.goto('/dashboard?range=3m');
		await page.locator('summary', { hasText: 'All categories' }).click();
		await page.getByRole('checkbox', { name: 'Supermarket' }).check();
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page).toHaveURL(/cat=\d+/);
		await expect(page.getByTestId('category-list').locator('li')).toHaveCount(1);
	});

	test('drill-down shows category KPIs, charts and a searchable, paged table', async ({ page }) => {
		await page.goto('/dashboard');
		await page.getByTestId('category-list').getByRole('link', { name: 'Supermarket' }).click();
		await expect(page).toHaveURL(/\/dashboard\/category\/supermarket/);
		await expect(page.getByRole('heading', { name: 'Supermarket' })).toBeVisible();
		await expect(page.getByTestId('kpi-count').locator('[data-kpi-value]')).toHaveText('24');
		await expect(page.getByTestId('kpi-share')).toContainText('%');
		await expect(page.locator('[data-chart-ready="true"]')).toHaveCount(2);
		await expect(page.getByTestId('chart-category-trend').locator('svg').first()).toBeVisible();

		const table = page.getByTestId('transactions-table');
		await expect(table.locator('tbody tr')).toHaveCount(20);
		await page.getByRole('link', { name: 'Next' }).click();
		await expect(table.locator('tbody tr')).toHaveCount(4);
		await expect(page).toHaveURL(/page=2/);

		await page.getByLabel('Search description').fill('FAKE 19');
		await page.getByRole('button', { name: 'Search' }).click();
		await expect(table.locator('tbody tr')).toHaveCount(6);
		await expect(table).toContainText('MERCADONA FAKE 19');

		await page.getByRole('link', { name: 'Amount' }).click();
		await expect(page).toHaveURL(/sort=amount_desc/);
		await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('all-transactions explorer paginates, searches and sorts', async ({ page }) => {
		await page.goto('/dashboard/transactions?range=all');
		await expect(page.getByRole('link', { name: 'Transactions', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		const table = page.getByTestId('transactions-table');
		await expect(table.locator('tbody tr')).toHaveCount(25);
		await page.getByLabel('Search description').fill('NETFLIX');
		await page.getByRole('button', { name: 'Search' }).click();
		await expect(table.locator('tbody tr')).toHaveCount(9);
		await expect(page).toHaveURL(/range=all/);
		await expect(page).toHaveURL(/q=NETFLIX/);
	});

	test('unknown categories 404 and bad params do not crash', async ({ page }) => {
		const res = await page.goto('/dashboard/category/does-not-exist');
		expect(res?.status()).toBe(404);
		const ok = await page.goto('/dashboard?range=zzz&g=hour&from=nope&cat=x');
		expect(ok?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});
});
