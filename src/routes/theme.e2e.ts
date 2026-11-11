import { expect, test, type Page } from '@playwright/test';
import { seedSynthetic } from '../../e2e/synthetic.ts';

const theme = (page: Page) => page.locator('html').getAttribute('data-theme');
const pick = (page: Page, label: 'System' | 'Light' | 'Dark') =>
	page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: label }).click();

test.describe.serial('theme', () => {
	test.beforeAll(async () => {
		await seedSynthetic();
	});

	test('System follows prefers-color-scheme, live, with no flash', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(String(e)));

		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		expect(await theme(page)).toBe('dark');
		await expect(page.getByRole('button', { name: 'System' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const bg = await page.evaluate(
			() => getComputedStyle(document.body.parentElement!).backgroundColor
		);
		expect(bg).toBe('rgb(21, 22, 24)');

		await page.emulateMedia({ colorScheme: 'light' });
		await expect.poll(() => theme(page)).toBe('light');
		expect(errors).toEqual([]);
	});

	test('the choice switches data-theme, color-scheme and persists across reload', async ({
		page
	}) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/');
		await pick(page, 'Dark');
		expect(await theme(page)).toBe('dark');
		expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
			'dark'
		);
		await page.reload();
		expect(await theme(page)).toBe('dark');
		await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		// An explicit choice beats the OS preference.
		await pick(page, 'Light');
		await page.emulateMedia({ colorScheme: 'dark' });
		expect(await theme(page)).toBe('light');
		await pick(page, 'System');
		expect(await theme(page)).toBe('dark');
		expect(await page.evaluate(() => localStorage.getItem('hearth-theme'))).toBeNull();
	});

	test('charts re-theme live without errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(String(e)));
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/dashboard');
		const chart = page.locator('[data-chart-ready="true"]').first();
		await expect(chart).toHaveAttribute('data-chart-scheme', 'light');
		const labelColor = () =>
			chart
				.locator('svg text')
				.first()
				.evaluate((t) => t.getAttribute('fill'));
		const before = await labelColor();
		await pick(page, 'Dark');
		await expect(chart).toHaveAttribute('data-chart-scheme', 'dark');
		await expect(chart.locator('svg')).toBeVisible();
		await expect.poll(labelColor).not.toBe(before);
		// System preference change re-themes too.
		await pick(page, 'System');
		await page.emulateMedia({ colorScheme: 'light' });
		await expect(chart).toHaveAttribute('data-chart-scheme', 'light');
		expect(errors).toEqual([]);
	});

	test('the toggle is reachable on mobile with 44px targets', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto('/dashboard');
		const box = await page.getByRole('button', { name: 'Dark' }).boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});

	for (const [label, month, day, season] of [
		['Christmas week', 11, 25, 'xmas'],
		['New Year', 0, 1, 'nye'],
		['a normal day', 5, 15, null]
	] as const) {
		test(`season on ${label} follows the local date`, async ({ page }) => {
			await page.addInitScript(
				([m, d]) => {
					const RealDate = Date;
					const fixed = new RealDate(2026, m, d, 12).getTime();
					// @ts-expect-error minimal Date stub: only `new Date()` is pinned
					window.Date = class extends RealDate {
						constructor(...args: unknown[]) {
							// @ts-expect-error forwarding arbitrary constructor args
							super(...(args.length ? args : [fixed]));
						}
					};
				},
				[month, day]
			);
			await page.goto('/');
			const html = page.locator('html');
			if (season) await expect(html).toHaveAttribute('data-season', season);
			else await expect(html).not.toHaveAttribute('data-season', /.+/);
		});
	}
});
