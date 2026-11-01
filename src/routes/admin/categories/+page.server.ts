import { fail } from '@sveltejs/kit';
import {
	createCategory,
	listCategories,
	setCategoryArchived,
	updateCategory
} from '#lib/server/admin/categories.ts';
import { formToObject, parseInteger } from '#lib/server/admin/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ categories: await listCategories() });

export const actions: Actions = {
	create: async ({ request }) => {
		const values = formToObject(await request.formData());
		const result = await createCategory(values);
		if (!result.ok) return fail(400, { action: 'create', id: null, values, errors: result.errors });
		return { action: 'create', saved: result.value.name };
	},
	update: async ({ request }) => {
		const values = formToObject(await request.formData());
		const id = parseInteger(values.id);
		if (id === null)
			return fail(400, { action: 'update', id: null, values, errors: { _form: 'Missing id.' } });
		const result = await updateCategory(id, values);
		if (!result.ok) return fail(400, { action: 'update', id, values, errors: result.errors });
		return { action: 'update', saved: result.value.name };
	},
	archive: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await setCategoryArchived(id, true)))
			return fail(404, { action: 'archive', id, errors: { _form: 'Category not found.' } });
		return { action: 'archive', saved: 'Category archived' };
	},
	restore: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await setCategoryArchived(id, false)))
			return fail(404, { action: 'restore', id, errors: { _form: 'Category not found.' } });
		return { action: 'restore', saved: 'Category restored' };
	}
};
