import { asc, eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/index.ts';
import { categories, categoryRules, people, statements } from '../db/schema.ts';
import { applyRules } from '../categorizer-service.ts';
import { isDuplicateEntry } from './validate.ts';
import {
	RULES_FORMAT,
	RULES_VERSION,
	assignPriorities,
	parseRulesFile,
	planImport,
	serializeRulesFile,
	type FileCategory,
	type FileRule,
	type ImportPlan,
	type InvalidEntry,
	type LocalState,
	type RulesFile
} from './rules-file.ts';

/** The Db or an open transaction: both expose the same query builders. */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Conn = Db | Tx;

export interface ExportOptions {
	/** Only rules that are switched on. */
	onlyActive?: boolean;
	/** Include every category, not just the ones the exported rules point to. */
	allCategories?: boolean;
	now?: Date;
}

/** Rules and categories as a versioned, id-free document. Never contains statement data. */
export async function exportRules(
	opts: ExportOptions = {},
	db: Conn = getDb()
): Promise<RulesFile> {
	const rows = await db
		.select({
			pattern: categoryRules.pattern,
			matchType: categoryRules.matchType,
			direction: categoryRules.direction,
			categorySlug: categories.slug,
			person: people.name,
			priority: categoryRules.priority,
			isActive: categoryRules.isActive
		})
		.from(categoryRules)
		.innerJoin(categories, eq(categoryRules.categoryId, categories.id))
		.leftJoin(people, eq(categoryRules.personId, people.id))
		.orderBy(asc(categoryRules.priority), asc(categoryRules.id));
	const rules: FileRule[] = rows
		.filter((r) => !opts.onlyActive || r.isActive)
		.map((r) => ({ ...r, person: r.person ?? null }));
	const used = new Set(rules.map((r) => r.categorySlug));
	const cats = await db
		.select()
		.from(categories)
		.orderBy(asc(categories.sortOrder), asc(categories.id));
	return {
		format: RULES_FORMAT,
		version: RULES_VERSION,
		exportedAt: (opts.now ?? new Date()).toISOString(),
		categories: cats
			.filter((c) => opts.allCategories || used.has(c.slug))
			.map((c) => ({
				slug: c.slug,
				name: c.name,
				kind: c.kind,
				color: c.color,
				icon: c.icon,
				sortOrder: c.sortOrder,
				isActive: c.isActive
			})),
		rules
	};
}

export const exportRulesJson = async (opts: ExportOptions = {}, db: Conn = getDb()) =>
	serializeRulesFile(await exportRules(opts, db));

export async function loadLocalState(db: Conn): Promise<LocalState> {
	const rules = await db
		.select({
			id: categoryRules.id,
			pattern: categoryRules.pattern,
			matchType: categoryRules.matchType,
			direction: categoryRules.direction,
			categorySlug: categories.slug,
			person: people.name,
			priority: categoryRules.priority,
			isActive: categoryRules.isActive
		})
		.from(categoryRules)
		.innerJoin(categories, eq(categoryRules.categoryId, categories.id))
		.leftJoin(people, eq(categoryRules.personId, people.id));
	const cats = await db.select({ slug: categories.slug }).from(categories);
	const folks = await db.select({ name: people.name }).from(people);
	return {
		rules: rules.map((r) => ({ ...r, person: r.person ?? null })),
		categorySlugs: new Set(cats.map((c) => c.slug)),
		people: new Set(folks.map((p) => p.name))
	};
}

export type ImportPreview =
	| { ok: false; error: string }
	| {
			ok: true;
			plan: ImportPlan;
			/** Normalised, valid content of the file: carried in the confirm form. */
			payload: string;
			/** Invalid entries at preview time (file level + local data), re-checked on confirm. */
			invalidCount: number;
			/** Invalid because of the local data (unknown category or person): re-checked on confirm. */
			planInvalidCount: number;
			fileInvalid: InvalidEntry[];
			counts: { rules: number; categories: number };
	  };

/** Parses and diffs an uploaded file. Writes nothing. */
export async function previewImport(text: string, db: Conn = getDb()): Promise<ImportPreview> {
	const parsed = parseRulesFile(text);
	if (!parsed.ok) return parsed;
	const plan = planImport(parsed.file, await loadLocalState(db));
	const invalid = [...parsed.invalid, ...plan.invalid].sort(
		(a, b) => a.index - b.index || a.kind.localeCompare(b.kind)
	);
	return {
		ok: true,
		plan: { ...plan, invalid },
		payload: serializeRulesFile(parsed.file),
		invalidCount: invalid.length,
		planInvalidCount: plan.invalid.length,
		fileInvalid: parsed.invalid,
		counts: { rules: parsed.file.rules.length, categories: parsed.file.categories.length }
	};
}

export interface ImportOptions {
	/** What to do with a rule that exists with different settings. Default: keep mine. */
	conflicts?: 'keep' | 'imported';
	/** Create categories the file defines and local rules lack. Default: true. */
	createMissingCategories?: boolean;
	/** Re-apply the rules to uncategorised and rule-set rows afterwards. Default: true. */
	reapply?: boolean;
	/** Entries invalid because of the local data that the user saw in the preview; more aborts. */
	expectedInvalid?: number;
	/** Entries the file itself got wrong (already left out of the payload); only for the report. */
	fileInvalid?: number;
}

export interface ImportResult {
	createdRules: number;
	updatedRules: number;
	identicalSkipped: number;
	conflictsKept: number;
	skippedInvalid: number;
	skippedMissingCategory: number;
	categoriesCreated: number;
	/** Rows whose category changed after the re-apply; null when it was not requested. */
	recategorised: number | null;
}

export type ImportOutcome = { ok: true; result: ImportResult } | { ok: false; error: string };

class Abort extends Error {}

async function nonManualSnapshot(tx: Conn): Promise<Map<number, string>> {
	const rows = await tx
		.select({ id: statements.id, c: statements.categoryId, s: statements.categorySource })
		.from(statements)
		.where(sql`${statements.categorySource} IS NULL OR ${statements.categorySource} <> 'manual'`);
	return new Map(rows.map((r) => [r.id, `${r.c ?? ''}:${r.s ?? ''}`]));
}

/**
 * Applies a previously previewed payload in ONE transaction: any error (including a rule that
 * became invalid since the preview) rolls everything back. The payload is re-validated and
 * re-diffed here; nothing from the preview is trusted.
 */
export async function confirmImport(
	payload: string,
	opts: ImportOptions = {},
	db: Db = getDb()
): Promise<ImportOutcome> {
	const parsed = parseRulesFile(payload);
	if (!parsed.ok) return { ok: false, error: parsed.error };
	if (parsed.invalid.length > 0) {
		return { ok: false, error: 'The import data is not valid. Nothing was written.' };
	}
	const mode = opts.conflicts === 'imported' ? 'imported' : 'keep';
	const createMissing = opts.createMissingCategories !== false;
	try {
		const result = await db.transaction(async (tx): Promise<ImportResult> => {
			const plan = planImport(parsed.file, await loadLocalState(tx));
			if (plan.invalid.length > (opts.expectedInvalid ?? 0)) {
				throw new Abort(
					`${plan.invalid.length} entries are invalid now (the preview showed ${opts.expectedInvalid ?? 0}); the data changed since the preview. Nothing was written, preview again.`
				);
			}
			let categoriesCreated = 0;
			if (createMissing && plan.categoriesToCreate.length) {
				await tx.insert(categories).values(plan.categoriesToCreate.map(toCategoryRow));
				categoriesCreated = plan.categoriesToCreate.length;
			}
			const catIds = new Map(
				(await tx.select({ id: categories.id, slug: categories.slug }).from(categories)).map(
					(c) => [c.slug, c.id]
				)
			);
			const personIds = new Map(
				(await tx.select({ id: people.id, name: people.name }).from(people)).map((p) => [
					p.name,
					p.id
				])
			);
			const existing = await tx.select({ priority: categoryRules.priority }).from(categoryRules);

			const toCreate = [...plan.newRules, ...(createMissing ? plan.missingCategory : [])].map(
				(i) => i.rule
			);
			const assigned = assignPriorities(
				toCreate,
				existing.map((r) => r.priority)
			);
			if (assigned.length) {
				await tx.insert(categoryRules).values(
					assigned.map(({ rule, priority }) => ({
						pattern: rule.pattern,
						matchType: rule.matchType,
						direction: rule.direction,
						categoryId: catIds.get(rule.categorySlug)!,
						personId: rule.person === null ? null : personIds.get(rule.person)!,
						priority,
						isActive: rule.isActive
					}))
				);
			}

			let updatedRules = 0;
			let conflictsKept = 0;
			for (const c of plan.conflicts) {
				if (mode === 'keep' || (c.needsCategory && !createMissing)) {
					conflictsKept++;
					continue;
				}
				await tx
					.update(categoryRules)
					.set({
						categoryId: catIds.get(c.rule.categorySlug)!,
						direction: c.rule.direction,
						personId: c.rule.person === null ? null : personIds.get(c.rule.person)!,
						isActive: c.rule.isActive
					})
					.where(eq(categoryRules.id, c.existing!.id));
				updatedRules++;
			}

			let recategorised: number | null = null;
			if (opts.reapply !== false) {
				const before = await nonManualSnapshot(tx);
				await applyRules(tx, sql`1 = 1`);
				const after = await nonManualSnapshot(tx);
				recategorised = [...after].filter(([id, v]) => before.get(id) !== v).length;
			}
			return {
				createdRules: assigned.length,
				updatedRules,
				identicalSkipped: plan.identical.length,
				conflictsKept,
				skippedInvalid: plan.invalid.length + (opts.fileInvalid ?? 0),
				skippedMissingCategory: createMissing ? 0 : plan.missingCategory.length,
				categoriesCreated,
				recategorised
			};
		});
		return { ok: true, result };
	} catch (err) {
		if (err instanceof Abort) return { ok: false, error: err.message };
		if (isDuplicateEntry(err)) {
			return {
				ok: false,
				error: 'A rule or category was added in the meantime. Nothing was written, preview again.'
			};
		}
		throw err;
	}
}

function toCategoryRow(c: FileCategory) {
	return {
		slug: c.slug,
		name: c.name,
		kind: c.kind,
		color: c.color,
		icon: c.icon,
		sortOrder: c.sortOrder,
		isActive: c.isActive
	};
}
