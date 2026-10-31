import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import DateInput from './DateInput.svelte';

const field = () => page.getByPlaceholder('dd/mm/yyyy');
const iso = (container: HTMLElement) =>
	container.querySelector<HTMLInputElement>('input[type="hidden"][name="when"]')?.value;

describe('DateInput', () => {
	it('shows an ISO value as dd/mm/yyyy and submits ISO under the given name', async () => {
		const { container } = render(DateInput, { id: 'd', name: 'when', value: '2026-10-30' });
		await expect.element(field()).toHaveValue('30/10/2026');
		await expect.poll(() => iso(container)).toBe('2026-10-30');
	});

	it('inserts slashes while typing and updates the hidden ISO value', async () => {
		const { container } = render(DateInput, { id: 'd', name: 'when' });
		await field().fill('');
		await userEvent.type(field(), '30102026');
		await expect.element(field()).toHaveValue('30/10/2026');
		await expect.poll(() => iso(container)).toBe('2026-10-30');
	});

	it('rejects impossible dates with an inline message and a blocked submit', async () => {
		const { container } = render(DateInput, { id: 'd', name: 'when' });
		await userEvent.type(field(), '31022026');
		await expect.element(page.getByText('Enter a real date as dd/mm/yyyy.')).toBeVisible();
		await expect.poll(() => iso(container)).toBe('');
		await expect.element(field()).toHaveAttribute('aria-invalid', 'true');
		const input = container.querySelector<HTMLInputElement>('#d')!;
		expect(input.checkValidity()).toBe(false);
	});

	it('rejects month 13', async () => {
		render(DateInput, { id: 'd', name: 'when' });
		await userEvent.type(field(), '13132026');
		await expect.element(page.getByText('Enter a real date as dd/mm/yyyy.')).toBeVisible();
	});

	it('exposes a calendar button and the error region is live', async () => {
		const { container } = render(DateInput, { id: 'd', name: 'when' });
		await expect.element(page.getByRole('button', { name: 'Open calendar' })).toBeVisible();
		expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
	});

	it('fills the text field from the native picker', async () => {
		const { container } = render(DateInput, { id: 'd', name: 'when' });
		const picker = container.querySelector<HTMLInputElement>('input[type="date"]')!;
		picker.value = '2026-02-28';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		await expect.element(field()).toHaveValue('28/02/2026');
		await expect.poll(() => iso(container)).toBe('2026-02-28');
	});
});
