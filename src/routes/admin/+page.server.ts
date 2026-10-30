import { fail } from '@sveltejs/kit';
import { importUploads, listBatches, supportedImporters } from '#lib/server/admin/imports.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	batches: await listBatches(30),
	importers: supportedImporters()
});

export const actions: Actions = {
	upload: async ({ request }) => {
		const form = await request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.name !== '');
		if (files.length === 0) {
			return fail(400, { results: [], message: 'Choose at least one file to import.' });
		}
		const uploads = await Promise.all(
			files.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) }))
		);
		return { results: await importUploads(uploads), message: null };
	}
};
