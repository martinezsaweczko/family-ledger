import { fail } from '@sveltejs/kit';
import { changeCategory, clearOverride } from './overrides.ts';
import { parseInteger } from './validate.ts';

/**
 * Shared SvelteKit form actions for "Change category" on any transaction list.
 * Each page re-exports them (`export const actions = overrideActions`); the form posts to
 * the current URL including its query string, so filters, page and sort survive.
 */
export const overrideActions = {
	setCategory: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const statementId = parseInteger(form.get('statementId'));
		const categoryId = parseInteger(form.get('categoryId'));
		if (statementId === null) return fail(400, { override: { error: 'Missing transaction.' } });
		if (categoryId === null) {
			return fail(400, { override: { statementId, error: 'Choose a category first.' } });
		}
		const createRule = form.get('createRule') === 'on';
		const result = await changeCategory({
			statementId,
			categoryId,
			rulePattern: createRule ? String(form.get('pattern') ?? '') : undefined
		});
		if (!result.ok) {
			return fail(400, {
				override: { statementId, error: Object.values(result.errors).join(' ') }
			});
		}
		return {
			override: {
				statementId,
				saved: true as const,
				rule: result.value.rule,
				alsoCategorised: result.value.alsoCategorised
			}
		};
	},
	clearCategory: async ({ request }: { request: Request }) => {
		const statementId = parseInteger((await request.formData()).get('statementId'));
		if (statementId === null) return fail(400, { override: { error: 'Missing transaction.' } });
		const result = await clearOverride(statementId);
		if (!result.ok) {
			return fail(400, {
				override: { statementId, error: Object.values(result.errors).join(' ') }
			});
		}
		return { override: { statementId, cleared: true as const } };
	}
};
