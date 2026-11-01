import { expect, test } from '@playwright/test';

// The preview server is Vite's, not adapter-node, so its origin is derived from the real Host
// (http://localhost:4173) and Kit's own check never tripped here; this exercises our own check.
const action = '/admin/rules?/reapply';

test('a real form submission from the page is accepted', async ({ page }) => {
	await page.goto('/admin/rules');
	await page
		.getByRole('button', { name: /re-?apply/i })
		.first()
		.click();
	await expect(page.getByText(/forbidden/i)).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin\/rules/);
});

test('same-host posts pass regardless of scheme, foreign and missing origins are rejected', async ({
	request
}) => {
	const post = (headers: Record<string, string>) =>
		request.post(action, { form: { x: '1' }, headers, maxRedirects: 0 });
	expect((await post({ origin: 'http://localhost:4173' })).status()).not.toBe(403);
	expect((await post({ origin: 'https://localhost:4173' })).status()).not.toBe(403);
	expect((await post({ origin: 'http://evil.example' })).status()).toBe(403);
	expect((await post({ origin: 'null' })).status()).toBe(403);
	expect((await post({ origin: '' })).status()).toBe(403);
});
