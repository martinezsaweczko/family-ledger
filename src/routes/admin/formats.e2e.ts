import { expect, test } from '@playwright/test';
import { seedSynthetic } from '../../../e2e/synthetic.ts';

// European formats end to end. Synthetic data only.
test.describe.serial('european dates and amounts', () => {
	test('date field masks, validates and posts; amount takes 1.234,56', async ({ page }) => {
		await seedSynthetic();
		await page.goto('/admin/manual');
		const form = page.locator('form[action$="/addEntry"]');
		const date = form.getByLabel('Date', { exact: true });
		await expect(date).toHaveAttribute('placeholder', 'dd/mm/yyyy');
		await expect(date).toHaveAttribute('inputmode', 'numeric');

		await date.fill('');
		await date.pressSequentially('31022026');
		await expect(date).toHaveValue('31/02/2026');
		await expect(form.getByText('Enter a real date as dd/mm/yyyy.')).toBeVisible();

		await date.fill('');
		await date.pressSequentially('15012026');
		await expect(date).toHaveValue('15/01/2026');
		await expect(form.getByText('Enter a real date as dd/mm/yyyy.')).toHaveCount(0);

		await form.getByLabel('Amount (EUR)').fill('1.234,56');
		await form.getByLabel('Concept').fill('Format check Zq');
		await form.getByRole('button', { name: 'Add payment' }).click();
		await expect(page.getByRole('status').first()).toContainText('Payment added');

		const row = page.getByTestId('manual-row').filter({ hasText: 'Format check Zq' });
		await expect(row).toContainText('15/01/2026');
		await expect(row).toContainText('-1.234,56 €');
	});

	test('an impossible date does not submit', async ({ page }) => {
		await page.goto('/admin/manual');
		const form = page.locator('form[action$="/addEntry"]');
		// DateInput only renders its calendar button after hydration; typing earlier is overwritten.
		await expect(page.getByRole('button', { name: 'Open calendar' }).first()).toBeVisible();
		await form.getByLabel('Date', { exact: true }).fill('13/13/2026');
		await form.getByLabel('Amount (EUR)').fill('5');
		await form.getByLabel('Concept').fill('Never saved Zq');
		await form.getByRole('button', { name: 'Add payment' }).click();
		await expect(page).toHaveURL(/\/admin\/manual$/);
		await expect(page.getByText('Never saved Zq')).toHaveCount(0);
		await expect(form.getByText('Enter a real date as dd/mm/yyyy.')).toBeVisible();
	});

	test('the calendar button opens a picker that fills the field', async ({ page }) => {
		await page.goto('/admin/manual');
		const form = page.locator('form[action$="/addEntry"]');
		await expect(form.getByRole('button', { name: 'Open calendar' })).toBeVisible();
		await form.locator('input[type="date"]').evaluate((el: HTMLInputElement) => {
			el.value = '2026-02-28';
			el.dispatchEvent(new Event('change', { bubbles: true }));
		});
		await expect(form.getByLabel('Date', { exact: true })).toHaveValue('28/02/2026');
	});

	test('the filter bar accepts dd/mm/yyyy and the URL carries ISO', async ({ page }) => {
		await page.goto('/dashboard?range=all');
		// DateInput only renders its calendar button after hydration; typing earlier is overwritten.
		await expect(page.getByRole('button', { name: 'Open calendar' }).first()).toBeVisible();
		await page.getByLabel('From', { exact: true }).fill('01/02/2026');
		await page.getByLabel('To', { exact: true }).fill('28/02/2026');
		await page.getByRole('button', { name: 'Apply dates' }).click();
		await expect(page).toHaveURL(/from=2026-02-01&to=2026-02-28/);
		await expect(page.getByLabel('From', { exact: true })).toHaveValue('01/02/2026');
		await expect(page.getByTestId('range-caption')).toHaveText('01/02/2026 to 28/02/2026');
	});

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });
		test('the text fields post dd/mm/yyyy and the server parses it', async ({ page }) => {
			await page.goto('/admin/manual');
			const form = page.locator('form[action$="/addEntry"]');
			await form.getByLabel('Date', { exact: true }).fill('02/03/2026');
			await form.getByLabel('Amount (EUR)').fill('7,5');
			await form.getByLabel('Concept').fill('No JS Zq');
			await form.getByRole('button', { name: 'Add payment' }).click();
			await expect(page.getByRole('status').first()).toContainText('Payment added');
			const row = page.getByTestId('manual-row').filter({ hasText: 'No JS Zq' });
			await expect(row).toContainText('02/03/2026');
			await expect(row).toContainText('-7,50 €');
			await page.goto('/dashboard?range=all&from=01%2F02%2F2026&to=28%2F02%2F2026');
			await expect(page.getByTestId('range-caption')).toHaveText('01/02/2026 to 28/02/2026');
		});
	});
});
