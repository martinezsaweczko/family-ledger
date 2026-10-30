import { fail } from '@sveltejs/kit';
import { activeCategories } from '#lib/server/admin/categories.ts';
import {
	createRule,
	deleteRule,
	listPeople,
	listRules,
	moveRule,
	previewRule,
	reapplyAll,
	updateRule
} from '#lib/server/admin/rules.ts';
import { formToObject, parseInteger } from '#lib/server/admin/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const test = url.searchParams.get('test');
	const testInput = {
		pattern: test ?? '',
		matchType: url.searchParams.get('type') ?? 'contains',
		direction: url.searchParams.get('dir') ?? 'any'
	};
	const preview = test === null ? null : await previewRule(testInput);
	const [rules, categories, people] = await Promise.all([
		listRules(),
		activeCategories(),
		listPeople()
	]);
	return { rules, categories, people, testInput, preview };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const values = formToObject(await request.formData());
		const result = await createRule(values);
		if (!result.ok) return fail(400, { action: 'create', id: null, values, errors: result.errors });
		return { action: 'create', saved: 'Rule created' };
	},
	update: async ({ request }) => {
		const values = formToObject(await request.formData());
		const id = parseInteger(values.id);
		if (id === null)
			return fail(400, { action: 'update', id: null, values, errors: { _form: 'Missing id.' } });
		const result = await updateRule(id, values);
		if (!result.ok) return fail(400, { action: 'update', id, values, errors: result.errors });
		return { action: 'update', saved: 'Rule updated' };
	},
	delete: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await deleteRule(id)))
			return fail(404, { action: 'delete', id: null, errors: { _form: 'Rule not found.' } });
		return { action: 'delete', saved: 'Rule deleted' };
	},
	move: async ({ request }) => {
		const form = await request.formData();
		const id = parseInteger(form.get('id'));
		const dir = form.get('dir') === 'down' ? 'down' : 'up';
		if (id !== null) await moveRule(id, dir);
		return { action: 'move', saved: 'Order updated' };
	},
	reapply: async () => {
		const result = await reapplyAll();
		return { action: 'reapply', saved: 'Rules re-applied', reapplied: result };
	}
};
