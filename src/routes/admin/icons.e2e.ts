import { expect, test } from '@playwright/test';
import { seedSynthetic } from '../../../e2e/synthetic.ts';

// Synthetic data only.
test.describe.serial('category icons', () => {
	test('chips on the dashboard and the table show category icons and the Supplies name', async ({
		page
	}) => {
		await seedSynthetic();
		await page.goto('/dashboard');
		const list = page.getByTestId('category-list');
		await expect(
			list.locator('li', { hasText: 'Supermarket' }).locator('[data-icon]')
		).toHaveAttribute('data-icon', 'shopping-basket');
		await expect(
			list.locator('li', { hasText: 'Supplies' }).locator('[data-icon]')
		).toHaveAttribute('data-icon', 'zap');
		await expect(page.getByText('Suministros')).toHaveCount(0);
		// Icons are decorative next to the name.
		await expect(list.locator('[data-icon]').first()).toHaveAttribute('aria-hidden', 'true');

		await page.goto('/dashboard/transactions?q=ENERGIA');
		await expect(
			page.getByTestId('transactions-table').locator('[data-icon="zap"]').first()
		).toBeAttached();

		await page.goto('/dashboard/category/utilities');
		await expect(page.getByRole('heading', { level: 1, name: 'Supplies' })).toBeVisible();
		await expect(page.locator('header [data-icon="zap"]')).toBeVisible();
	});

	test('the icon picker filters, previews and saves on create and edit', async ({ page }) => {
		await page.goto('/admin/categories');
		const form = page.locator('form[action="?/create"]');
		await form.getByLabel('Name').fill('Pottery Zq');
		await form.getByLabel('Filter icons').fill('paw');
		await expect(form.getByRole('radio', { name: 'Paw print' })).toBeAttached();
		await expect(form.getByRole('radio', { name: 'Bus' })).toHaveCount(0);
		await form.getByRole('radio', { name: 'Paw print' }).check({ force: true });
		await expect(form.getByTestId('icon-preview').locator('[data-icon]')).toHaveAttribute(
			'data-icon',
			'paw-print'
		);
		await form.getByRole('button', { name: 'Add category' }).click();
		await expect(page.getByRole('status').first()).toContainText('Pottery Zq');
		const item = page.locator('li', { hasText: 'Pottery Zq' }).first();
		await expect(item.locator('[data-icon]').first()).toHaveAttribute('data-icon', 'paw-print');

		await item.getByText('Edit Pottery Zq').click();
		const edit = item.locator('form[action="?/update"]');
		await edit.getByRole('radio', { name: 'Wi-Fi' }).check({ force: true });
		await edit.getByRole('button', { name: 'Save changes' }).click();
		await expect(
			page.locator('li', { hasText: 'Pottery Zq' }).first().locator('[data-icon]').first()
		).toHaveAttribute('data-icon', 'wifi');
	});

	test('the server rejects an icon key outside the registry', async ({ request }) => {
		const res = await request.post('/admin/categories?/create', {
			headers: { origin: 'http://localhost:4173' },
			form: { name: 'Bad Icon Zq', color: '#0F9488', kind: 'expense', icon: 'rocket-ship' }
		});
		expect(await res.text()).toContain('Choose an icon from the list');
	});
});
