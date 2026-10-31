import { expect, test } from '@playwright/test';
import { like } from 'drizzle-orm';
import { createDb } from '../../lib/server/db/index.ts';
import { categoryRules } from '../../lib/server/db/schema.ts';
import { E2E_DATABASE_URL } from '../../../e2e/db.mjs';

const file = JSON.stringify({
	format: 'hearth.rules',
	version: 1,
	exportedAt: '2026-01-01T00:00:00.000Z',
	categories: [
		{
			slug: 'pets-e2e',
			name: 'Pets E2E',
			kind: 'expense',
			color: '#336699',
			icon: null,
			sortOrder: 99,
			isActive: true
		}
	],
	rules: [
		{ pattern: 'E2E IMPORT ONE ZQ', categorySlug: 'shopping', priority: 91001 },
		{ pattern: 'E2E IMPORT PET ZQ', categorySlug: 'pets-e2e', priority: 91002 },
		{ pattern: '(', matchType: 'regex', categorySlug: 'shopping' }
	]
});

test.describe.serial('rules export and import', () => {
	test.afterAll(async () => {
		const h = createDb(E2E_DATABASE_URL);
		await h.db.delete(categoryRules).where(like(categoryRules.pattern, 'E2E IMPORT%'));
		await h.pool.end();
	});

	test('export downloads versioned JSON without ids', async ({ page }) => {
		await page.goto('/admin/rules');
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download rules (JSON)' }).click();
		const dl = await download;
		expect(dl.suggestedFilename()).toMatch(/^hearth-rules-\d{4}-\d{2}-\d{2}\.json$/);
		const path = await dl.path();
		const data = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8'));
		expect(data).toMatchObject({ format: 'hearth.rules', version: 1 });
		expect(data.rules.length).toBeGreaterThan(5);
		expect(JSON.stringify(data)).not.toMatch(/"(id|categoryId|personId)"/);

		const res = await page.request.get('/admin/rules/export?active=1&categories=all');
		expect(res.headers()['content-type']).toContain('application/json');
		expect(res.headers()['content-disposition']).toContain('attachment');
	});

	test('upload -> preview -> confirm -> result, then a second import creates nothing', async ({
		page
	}) => {
		await page.goto('/admin/rules');
		await page.getByLabel(/Rules file/).setInputFiles({
			name: 'share.json',
			mimeType: 'application/json',
			buffer: Buffer.from(file)
		});
		await page.getByRole('button', { name: 'Preview import' }).click();

		const preview = page.getByTestId('import-preview');
		await expect(preview).toContainText('Nothing has been written yet');
		await expect(page.getByTestId('import-new')).toContainText('E2E IMPORT ONE ZQ');
		await expect(page.getByTestId('import-missing')).toContainText('E2E IMPORT PET ZQ');
		await expect(page.getByTestId('import-invalid')).toContainText('Invalid regular expression');
		// nothing written yet
		await expect(page.getByRole('heading', { name: /All rules \(/ })).toBeVisible();
		expect(await page.getByText('E2E IMPORT ONE ZQ').count()).toBe(1);

		await preview.getByRole('button', { name: 'Import now' }).click();
		const result = page.getByTestId('import-result');
		await expect(result).toBeVisible();
		await expect(page.getByTestId('result-created')).toHaveText('2');
		await expect(page.getByTestId('result-categories')).toHaveText('1');
		await expect(page.getByTestId('result-invalid')).toHaveText('1');
		await expect(page.getByRole('list').getByText('E2E IMPORT PET ZQ').first()).toBeVisible();

		// Same file again: everything is identical, so there is nothing to import.
		await page.getByLabel(/Rules file/).setInputFiles({
			name: 'share.json',
			mimeType: 'application/json',
			buffer: Buffer.from(file)
		});
		await page.getByRole('button', { name: 'Preview import' }).click();
		await expect(page.getByTestId('import-nothing')).toBeVisible();
		await expect(page.getByTestId('import-new')).toHaveCount(0);
	});

	test('rejects files that are not rules files', async ({ page }) => {
		await page.goto('/admin/rules');
		await page.getByLabel(/Rules file/).setInputFiles({
			name: 'bad.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{oops')
		});
		await page.getByRole('button', { name: 'Preview import' }).click();
		await expect(page.getByTestId('import-error')).toContainText('not valid JSON');
	});
});
