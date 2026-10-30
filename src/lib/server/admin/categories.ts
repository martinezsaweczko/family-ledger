import { asc, count, eq, like } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements, type Category } from '../db/schema.ts';
import {
	fail,
	isDuplicateEntry,
	normalizeHex,
	parseInteger,
	text,
	type Result
} from './validate.ts';

export const CATEGORY_KINDS = ['expense', 'income', 'transfer', 'ignore'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface CategoryInput {
	name: string;
	color: string;
	kind: CategoryKind;
	sortOrder: number;
}

export function validateCategory(raw: Record<string, unknown>): Result<CategoryInput> {
	const errors: Record<string, string> = {};
	const name = text(raw.name);
	if (!name) errors.name = 'Name is required.';
	else if (name.length > 80) errors.name = 'Name must be at most 80 characters.';
	const color = normalizeHex(raw.color);
	if (!color) errors.color = 'Colour must be a hex value such as #0F9488.';
	const kind = text(raw.kind) as CategoryKind;
	if (!CATEGORY_KINDS.includes(kind)) errors.kind = 'Choose a kind.';
	const sortRaw = text(raw.sortOrder);
	const sortOrder = sortRaw === '' ? 0 : parseInteger(sortRaw);
	if (sortOrder === null || Math.abs(sortOrder) > 100000) {
		errors.sortOrder = 'Sort order must be a whole number.';
	}
	if (Object.keys(errors).length) return fail(errors);
	return { ok: true, value: { name, color: color!, kind, sortOrder: sortOrder! } };
}

export interface CategoryRow extends Category {
	statementCount: number;
}

export async function listCategories(db: Db = getDb()): Promise<CategoryRow[]> {
	const counts = await db
		.select({ id: statements.categoryId, n: count() })
		.from(statements)
		.groupBy(statements.categoryId);
	const byId = new Map(counts.map((c) => [c.id, c.n]));
	const rows = await db
		.select()
		.from(categories)
		.orderBy(asc(categories.sortOrder), asc(categories.id));
	return rows.map((c) => ({ ...c, statementCount: byId.get(c.id) ?? 0 }));
}

export async function activeCategories(db: Db = getDb()): Promise<Category[]> {
	return db
		.select()
		.from(categories)
		.where(eq(categories.isActive, true))
		.orderBy(asc(categories.sortOrder), asc(categories.id));
}

function slugify(name: string): string {
	const base = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);
	return base || 'category';
}

export async function createCategory(
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<Category>> {
	const parsed = validateCategory(raw);
	if (!parsed.ok) return parsed;
	const taken = await db
		.select({ slug: categories.slug })
		.from(categories)
		.where(like(categories.slug, `${slugify(parsed.value.name)}%`));
	const used = new Set(taken.map((t) => t.slug));
	const base = slugify(parsed.value.name);
	let slug = base;
	for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
	try {
		const [{ insertId }] = await db.insert(categories).values({ ...parsed.value, slug });
		const [row] = await db
			.select()
			.from(categories)
			.where(eq(categories.id, Number(insertId)));
		return { ok: true, value: row };
	} catch (err) {
		if (isDuplicateEntry(err)) {
			return fail({ name: 'A category with this name already exists.' });
		}
		throw err;
	}
}

export async function updateCategory(
	id: number,
	raw: Record<string, unknown>,
	db: Db = getDb()
): Promise<Result<Category>> {
	const parsed = validateCategory(raw);
	if (!parsed.ok) return parsed;
	const [existing] = await db.select().from(categories).where(eq(categories.id, id));
	if (!existing) return fail({ _form: 'Category not found.' });
	await db.update(categories).set(parsed.value).where(eq(categories.id, id));
	return { ok: true, value: { ...existing, ...parsed.value } };
}

/**
 * Archiving hides a category from pickers but never touches statements or rules:
 * history keeps its category. Un-archive with `archived = false`.
 */
export async function setCategoryArchived(
	id: number,
	archived: boolean,
	db: Db = getDb()
): Promise<boolean> {
	const [res] = await db
		.update(categories)
		.set({ isActive: !archived })
		.where(eq(categories.id, id));
	return res.affectedRows > 0;
}
