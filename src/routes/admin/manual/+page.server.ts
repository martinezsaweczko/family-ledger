import { fail } from '@sveltejs/kit';
import { activeCategories } from '#lib/server/admin/categories.ts';
import { formToObject, parseInteger } from '#lib/server/admin/validate.ts';
import {
	createManualEntry,
	deleteManualEntry,
	listManualEntries,
	updateManualEntry
} from '#lib/server/manual/entries.ts';
import {
	countFutureGenerated,
	createRecurring,
	deleteRecurring,
	endRecurring,
	ensureMaterialised,
	listRecurring,
	setRecurringActive,
	updateRecurring
} from '#lib/server/manual/recurring.ts';
import { todayIso } from '#lib/server/manual/schedule.ts';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['all', 'oneoff', 'recurring'] as const;

export const load: PageServerLoad = async ({ url }) => {
	await ensureMaterialised();
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const kindParam = url.searchParams.get('kind');
	const kind = KINDS.find((k) => k === kindParam) ?? 'all';
	const page = Math.max(parseInteger(url.searchParams.get('page') ?? '1') ?? 1, 1);
	const today = todayIso();
	const [categories, entries, recurring] = await Promise.all([
		activeCategories(),
		listManualEntries({ page, pageSize: 15, search: q, kind }),
		listRecurring()
	]);
	const future = Object.fromEntries(
		await Promise.all(recurring.map(async (r) => [r.id, await countFutureGenerated(r.id, today)]))
	);
	return {
		today,
		q,
		kind,
		categories: categories.map((c) => ({
			id: c.id,
			name: c.name,
			icon: c.icon,
			slug: c.slug,
			color: c.color
		})),
		entries,
		recurring,
		future
	};
};

const idOf = (values: Record<string, string>) => parseInteger(values.id);

export const actions: Actions = {
	addEntry: async ({ request }) => {
		const values = formToObject(await request.formData());
		const res = await createManualEntry(values);
		if (!res.ok) return fail(400, { action: 'addEntry', id: null, values, errors: res.errors });
		return { action: 'addEntry', saved: 'Payment added' };
	},
	updateEntry: async ({ request }) => {
		const values = formToObject(await request.formData());
		const id = idOf(values);
		if (id === null)
			return fail(400, { action: 'updateEntry', id, values, errors: { _form: 'Missing id.' } });
		const res = await updateManualEntry(id, values);
		if (!res.ok) return fail(400, { action: 'updateEntry', id, values, errors: res.errors });
		return { action: 'updateEntry', saved: 'Payment updated' };
	},
	deleteEntry: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await deleteManualEntry(id)))
			return fail(404, { action: 'deleteEntry', id, errors: { _form: 'Manual entry not found.' } });
		return { action: 'deleteEntry', saved: 'Payment deleted' };
	},
	addRecurring: async ({ request }) => {
		const values = formToObject(await request.formData());
		const res = await createRecurring(values);
		if (!res.ok) return fail(400, { action: 'addRecurring', id: null, values, errors: res.errors });
		await ensureMaterialised(true);
		return { action: 'addRecurring', saved: 'Recurring payment added' };
	},
	updateRecurring: async ({ request }) => {
		const values = formToObject(await request.formData());
		const id = idOf(values);
		if (id === null)
			return fail(400, { action: 'updateRecurring', id, values, errors: { _form: 'Missing id.' } });
		const res = await updateRecurring(id, values);
		if (!res.ok) return fail(400, { action: 'updateRecurring', id, values, errors: res.errors });
		await ensureMaterialised(true);
		return { action: 'updateRecurring', saved: 'Recurring payment updated (future entries only)' };
	},
	pauseRecurring: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await setRecurringActive(id, false)))
			return fail(404, { action: 'pauseRecurring', id, errors: { _form: 'Not found.' } });
		return { action: 'pauseRecurring', saved: 'Recurring payment paused' };
	},
	resumeRecurring: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await setRecurringActive(id, true)))
			return fail(404, { action: 'resumeRecurring', id, errors: { _form: 'Not found.' } });
		await ensureMaterialised(true);
		return { action: 'resumeRecurring', saved: 'Recurring payment resumed' };
	},
	endRecurring: async ({ request }) => {
		const id = parseInteger((await request.formData()).get('id'));
		if (id === null || !(await endRecurring(id)))
			return fail(404, { action: 'endRecurring', id, errors: { _form: 'Not found.' } });
		return { action: 'endRecurring', saved: 'Recurring payment ended today' };
	},
	deleteRecurring: async ({ request }) => {
		const form = await request.formData();
		const id = parseInteger(form.get('id'));
		if (id === null)
			return fail(404, { action: 'deleteRecurring', id, errors: { _form: 'Not found.' } });
		const res = await deleteRecurring(id, { deleteFuture: form.get('deleteFuture') === 'on' });
		if (!res.deleted)
			return fail(404, { action: 'deleteRecurring', id, errors: { _form: 'Not found.' } });
		return {
			action: 'deleteRecurring',
			saved: `Recurring payment deleted${res.futureRemoved ? `, ${res.futureRemoved} future entries removed` : ''}`
		};
	}
};
