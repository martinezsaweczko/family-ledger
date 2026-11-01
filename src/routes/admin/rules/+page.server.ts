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
import { MAX_FILE_BYTES } from '#lib/server/admin/rules-file.ts';
import { confirmImport, previewImport } from '#lib/server/admin/rules-io.ts';
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
	previewImport: async ({ request }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { action: 'previewImport', importError: 'Choose a JSON file to import.' });
		}
		if (file.size > MAX_FILE_BYTES) {
			return fail(400, { action: 'previewImport', importError: 'The file is larger than 2 MB.' });
		}
		const preview = await previewImport(await file.text());
		if (!preview.ok) return fail(400, { action: 'previewImport', importError: preview.error });
		return {
			action: 'previewImport',
			importPreview: { ...preview, filename: file.name.slice(0, 120) }
		};
	},
	confirmImport: async ({ request }) => {
		const form = await request.formData();
		const payload = String(form.get('payload') ?? '');
		const outcome = await confirmImport(payload, {
			conflicts: form.get('conflicts') === 'imported' ? 'imported' : 'keep',
			createMissingCategories: form.get('createMissing') === 'on',
			reapply: form.get('reapply') === 'on',
			expectedInvalid: parseInteger(form.get('expectedInvalid')) ?? 0,
			fileInvalid: parseInteger(form.get('fileInvalid')) ?? 0
		});
		if (!outcome.ok) return fail(400, { action: 'confirmImport', importError: outcome.error });
		return { action: 'confirmImport', importResult: outcome.result };
	},
	reapply: async () => {
		const result = await reapplyAll();
		return { action: 'reapply', saved: 'Rules re-applied', reapplied: result };
	}
};
