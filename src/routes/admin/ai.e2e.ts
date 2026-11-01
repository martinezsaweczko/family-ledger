import { expect, test } from '@playwright/test';
import { buildDbXls } from '../../lib/server/importers/test-fixtures.ts';
import { seedSynthetic } from '../../../e2e/synthetic.ts';

// Synthetic data only. The AI service is e2e/ai-stub.mjs (port 4199); the app on 4174 has AI unset.
const STUB = 'http://127.0.0.1:4199';
const NO_AI = 'http://localhost:4174';

const file = {
	name: 'e2e-ai.xls',
	mimeType: 'application/vnd.ms-excel',
	buffer: buildDbXls([
		{
			date: '12/03/2026',
			valueDate: '12/03/2026',
			concept: 'TARJETA-AIKEEN BISTRO 1111',
			amount: -12.5,
			balance: 900
		},
		{
			date: '11/03/2026',
			valueDate: '11/03/2026',
			concept: 'TARJETA-AIKEEN BISTRO 2222',
			amount: -7.25,
			balance: 912.5
		},
		{
			date: '10/03/2026',
			valueDate: '10/03/2026',
			concept: 'TARJETA-UNSURE THING 3333',
			amount: -3,
			balance: 919.75
		}
	])
};

test.describe.serial('AI categorisation', () => {
	test('disabled when AI_BASE_URL is unset', async ({ page }) => {
		await page.goto(`${NO_AI}/admin`);
		await expect(page.getByTestId('ai-status').getByTestId('ai-disabled')).toContainText(
			'Disabled'
		);
		await expect(page.getByTestId('ai-test')).toHaveCount(0);
		await page.goto(`${NO_AI}/admin/review`);
		await expect(page.getByTestId('ai-disabled')).toBeVisible();
		await expect(page.getByTestId('ai-categorise')).toHaveCount(0);
	});

	test('admin status line shows model and host only, and Test connection works', async ({
		page
	}) => {
		await page.goto('/admin');
		const status = page.getByTestId('ai-status');
		await expect(status).toContainText('Enabled');
		await expect(status).toContainText('haiku');
		await expect(status).toContainText('127.0.0.1:4199');
		await expect(status).not.toContainText('/v1/chat');
		await page.getByTestId('ai-test').click();
		await expect(page.getByTestId('ai-test-result')).toContainText('Connected');
	});

	test('an upload shows the AI summary and AI rows appear with a badge', async ({ page }) => {
		await seedSynthetic();
		await page.request.post(`${STUB}/__reset`);
		await page.goto('/admin');
		await page.getByLabel(/Drop bank files here/).setInputFiles(file);
		await page.getByRole('button', { name: 'Import files' }).click();
		const card = page.getByRole('article', { name: 'Result for e2e-ai.xls' });
		await expect(card.getByTestId('ai-summary')).toContainText(
			'AI categorised 2 of 3 uncategorised rows'
		);
		await expect(card.locator('[data-stat="Uncategorised"]')).toHaveText('1');
		await expect(page.getByTestId('ai-last')).toContainText('Last run');

		// What was sent: cleaned text only, no digits, IBAN or dates.
		const { prompts } = await (await page.request.get(`${STUB}/__log`)).json();
		expect(prompts).toHaveLength(1);
		const items = prompts[0].split('Items')[1];
		expect(items).toContain('AIKEEN BISTRO');
		expect(items).not.toMatch(/1111|2222|3333/);
		expect(prompts[0]).not.toMatch(/ES0000|2026|12\/03/);

		await page.goto('/admin/review');
		const rows = page.getByTestId('ai-row');
		await expect(rows).toHaveCount(2);
		await expect(rows.first().getByTestId('badge-ai')).toHaveText(/AI · 82\s%/);
		await expect(rows.first()).toContainText('Eating out');
		await expect(page.getByTestId('review-row').filter({ hasText: 'UNSURE THING' })).toHaveCount(1);
	});

	test('the review button categorises what is left, bounded and without breaking', async ({
		page
	}) => {
		await page.goto('/admin/review');
		await page.getByTestId('ai-categorise').click();
		await expect(page.getByTestId('ai-run-result')).toContainText(
			'AI categorised 0 of 10 uncategorised rows'
		);
		await expect(page.getByTestId('review-row')).toHaveCount(10);
	});

	test('transactions list shows the AI badge; Accept locks it as manual', async ({ page }) => {
		await page.goto('/dashboard/transactions?range=all&q=BISTRO');
		const badges = page.getByTestId('badge-ai');
		await expect(badges).toHaveCount(2);
		await page.getByTestId('accept-ai').first().click();
		await expect(page.getByTestId('badge-ai')).toHaveCount(1);
		await expect(page.getByTestId('badge-edited')).toHaveCount(1);

		// A later AI run and a re-apply of the rules never touch the accepted row.
		await page.goto('/admin/review');
		await page.getByTestId('ai-categorise').click();
		await expect(page.getByTestId('ai-run-result')).toBeVisible();
		await page.goto('/dashboard/transactions?range=all&q=BISTRO');
		await expect(page.getByTestId('badge-edited')).toHaveCount(1);
	});

	test('changing the category of an AI row makes it a manual choice', async ({ page }) => {
		await page.goto('/admin/review');
		const row = page.getByTestId('ai-row').first();
		await row.getByRole('button', { name: 'Change category' }).click();
		await row.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
		await row.getByRole('button', { name: /^Save/ }).click();
		await expect(page.getByTestId('ai-row')).toHaveCount(0);
		await page.goto('/dashboard/transactions?range=all&q=BISTRO');
		await expect(page.getByTestId('badge-ai')).toHaveCount(0);
		await expect(page.getByTestId('badge-edited')).toHaveCount(2);
	});
});
