import { fail } from '@sveltejs/kit';
import { activeCategories } from '#lib/server/admin/categories.ts';
import { overrideActions } from '#lib/server/admin/override-actions.ts';
import { aiHost, getAiConfig } from '#lib/server/ai/config.ts';
import { categorizeWithAi } from '#lib/server/ai/categorize-ai.ts';
import {
	applySuggestion,
	assignCategory,
	listAiCategorised,
	listUncategorised,
	suggestedRules
} from '#lib/server/admin/review.ts';
import { parseInteger } from '#lib/server/admin/validate.ts';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(parseInteger(url.searchParams.get('page') ?? '1') ?? 1, 1);
	const [queue, categories, suggestions, aiRows] = await Promise.all([
		listUncategorised({ page, pageSize: PAGE_SIZE, search }),
		activeCategories(),
		suggestedRules(8),
		listAiCategorised({ limit: 20 })
	]);
	const cfg = getAiConfig();
	const ai = cfg ? { enabled: true, model: cfg.model, host: aiHost(cfg) } : { enabled: false };
	return { queue, search, categories, suggestions, aiRows, ai };
};

export const actions: Actions = {
	...overrideActions,
	/** Asks the AI about the current uncategorised rows, bounded like the post-import run. */
	categoriseAi: async () => ({ aiRun: await categorizeWithAi() }),
	assign: async ({ request }) => {
		const form = await request.formData();
		const statementId = parseInteger(form.get('statementId'));
		const categoryId = parseInteger(form.get('categoryId'));
		if (statementId === null || categoryId === null) {
			return fail(400, { statementId, errors: { categoryId: 'Choose a category first.' } });
		}
		const createRule = form.get('createRule') === 'on';
		const pattern = String(form.get('pattern') ?? '');
		const result = await assignCategory({
			statementId,
			categoryId,
			rulePattern: createRule ? pattern : undefined
		});
		if (!result.ok) return fail(400, { statementId, errors: result.errors });
		return { statementId, saved: result.value };
	},
	suggest: async ({ request }) => {
		const form = await request.formData();
		const categoryId = parseInteger(form.get('categoryId'));
		if (categoryId === null) {
			return fail(400, {
				suggestion: String(form.get('merchant')),
				errors: { categoryId: 'Choose a category first.' }
			});
		}
		const merchant = String(form.get('merchant') ?? '');
		const result = await applySuggestion({ merchant, categoryId });
		if (!result.ok) return fail(400, { suggestion: merchant, errors: result.errors });
		return { suggestion: merchant, applied: result.value };
	}
};
