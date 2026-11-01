import { isPickableIcon } from '../../icons/registry.ts';
import { CATEGORY_KINDS, type CategoryKind } from './categories.ts';
import { DIRECTIONS, MATCH_TYPES } from './rules.ts';
import { normalizeHex } from './validate.ts';

/**
 * Pure (no DB) part of the rules export/import: the file format, strict parsing and the diff
 * against the local rules. The DB side lives in `rules-io.ts`.
 *
 * File format `hearth.rules` v1. Rules reference categories by slug and people by name, never by
 * database id; nothing about statements, transactions or accounts is ever part of it.
 */
export const RULES_FORMAT = 'hearth.rules';
export const RULES_VERSION = 1;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RULES = 5000;
export const MAX_CATEGORIES = 500;
export const MAX_PATTERN = 255;
const MAX_PRIORITY = 100000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;

export interface FileCategory {
	slug: string;
	name: string;
	kind: CategoryKind;
	color: string;
	icon: string | null;
	sortOrder: number;
	isActive: boolean;
}

export interface FileRule {
	pattern: string;
	matchType: (typeof MATCH_TYPES)[number];
	direction: (typeof DIRECTIONS)[number];
	categorySlug: string;
	person: string | null;
	/** null = no priority given: the rule is appended after the existing ones. */
	priority: number | null;
	isActive: boolean;
}

export interface RulesFile {
	format: typeof RULES_FORMAT;
	version: typeof RULES_VERSION;
	exportedAt: string;
	categories: FileCategory[];
	rules: FileRule[];
}

export interface InvalidEntry {
	kind: 'rule' | 'category';
	/** 1-based position inside its array of the file. */
	index: number;
	/** Pattern or slug when it could be read, for display. */
	label: string;
	reason: string;
}

export type ParseResult =
	{ ok: true; file: RulesFile; invalid: InvalidEntry[] } | { ok: false; error: string };

/** Stable key order for the file: this is the order the keys are written in. */
export function serializeRulesFile(file: RulesFile): string {
	const ordered = {
		format: file.format,
		version: file.version,
		exportedAt: file.exportedAt,
		categories: file.categories.map((c) => ({
			slug: c.slug,
			name: c.name,
			kind: c.kind,
			color: c.color,
			icon: c.icon,
			sortOrder: c.sortOrder,
			isActive: c.isActive
		})),
		rules: file.rules.map((r) => ({
			pattern: r.pattern,
			matchType: r.matchType,
			direction: r.direction,
			categorySlug: r.categorySlug,
			person: r.person,
			priority: r.priority,
			isActive: r.isActive
		}))
	};
	return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Key of the database unique index (pattern, match type). MySQL compares with an accent- and
 * case-insensitive collation, so two patterns that differ only in case or accents collide there.
 */
export function ruleKey(pattern: string, matchType: string): string {
	const folded = pattern.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ +$/, '');
	return `${matchType}\u0000${folded}`;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function parseCategory(raw: unknown): { value?: FileCategory; label: string; reason?: string } {
	if (!isObject(raw)) return { label: '?', reason: 'Not an object.' };
	const label = typeof raw.slug === 'string' ? raw.slug.slice(0, 60) : '?';
	if (typeof raw.slug !== 'string' || !SLUG.test(raw.slug)) {
		return { label, reason: 'Slug must be lowercase letters, digits and dashes (max 60).' };
	}
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	if (!name || name.length > 80) return { label, reason: 'Name must be 1 to 80 characters.' };
	if (!CATEGORY_KINDS.includes(raw.kind as CategoryKind)) {
		return { label, reason: 'Kind must be expense, income, transfer or ignore.' };
	}
	const color = normalizeHex(raw.color);
	if (!color) return { label, reason: 'Colour must be a hex value such as #0F9488.' };
	let icon: string | null = null;
	if (raw.icon !== undefined && raw.icon !== null) {
		if (!isPickableIcon(raw.icon)) return { label, reason: 'Unknown icon.' };
		icon = raw.icon;
	}
	let sortOrder = 0;
	if (raw.sortOrder !== undefined && raw.sortOrder !== null) {
		if (!Number.isInteger(raw.sortOrder) || Math.abs(raw.sortOrder as number) > MAX_PRIORITY) {
			return { label, reason: 'Sort order must be a whole number.' };
		}
		sortOrder = raw.sortOrder as number;
	}
	if (raw.isActive !== undefined && typeof raw.isActive !== 'boolean') {
		return { label, reason: 'isActive must be true or false.' };
	}
	return {
		label,
		value: {
			slug: raw.slug,
			name,
			kind: raw.kind as CategoryKind,
			color,
			icon,
			sortOrder,
			isActive: raw.isActive !== false
		}
	};
}

function parseRule(raw: unknown): { value?: FileRule; label: string; reason?: string } {
	if (!isObject(raw)) return { label: '?', reason: 'Not an object.' };
	const label = typeof raw.pattern === 'string' ? raw.pattern.slice(0, 80) : '?';
	if (typeof raw.pattern !== 'string') return { label, reason: 'Pattern must be text.' };
	const pattern = raw.pattern.trim();
	if (!pattern) return { label, reason: 'Pattern is empty.' };
	if (pattern.length > MAX_PATTERN) {
		return { label, reason: `Pattern is longer than ${MAX_PATTERN} characters.` };
	}
	const matchType = raw.matchType ?? 'contains';
	if (!MATCH_TYPES.includes(matchType as FileRule['matchType'])) {
		return { label, reason: 'matchType must be contains or regex.' };
	}
	const direction = raw.direction ?? 'any';
	if (!DIRECTIONS.includes(direction as FileRule['direction'])) {
		return { label, reason: 'direction must be any, in or out.' };
	}
	if (matchType === 'regex') {
		try {
			new RegExp(pattern, 'i'); // the flags the categorizer compiles with
		} catch (err) {
			return {
				label,
				reason: `Invalid regular expression: ${(err as Error).message.replace(/^Invalid regular expression:\s*/, '')}`
			};
		}
	}
	if (typeof raw.categorySlug !== 'string' || !SLUG.test(raw.categorySlug)) {
		return { label, reason: 'categorySlug must be a category slug.' };
	}
	let person: string | null = null;
	if (raw.person !== undefined && raw.person !== null) {
		if (typeof raw.person !== 'string' || !raw.person.trim() || raw.person.length > 80) {
			return { label, reason: 'person must be a name or null.' };
		}
		person = raw.person.trim();
	}
	let priority: number | null = null;
	if (raw.priority !== undefined && raw.priority !== null) {
		if (!Number.isInteger(raw.priority) || (raw.priority as number) < 0) {
			return { label, reason: 'priority must be a whole number of at least 0.' };
		}
		if ((raw.priority as number) > MAX_PRIORITY) {
			return { label, reason: `priority must be at most ${MAX_PRIORITY}.` };
		}
		priority = raw.priority as number;
	}
	if (raw.isActive !== undefined && typeof raw.isActive !== 'boolean') {
		return { label, reason: 'isActive must be true or false.' };
	}
	return {
		label,
		value: {
			pattern,
			matchType: matchType as FileRule['matchType'],
			direction: direction as FileRule['direction'],
			categorySlug: raw.categorySlug,
			person,
			priority,
			isActive: raw.isActive !== false
		}
	};
}

/**
 * Strict parse. File-level problems (not JSON, wrong format or version, too big, not arrays)
 * fail the whole file; entry-level problems are collected in `invalid` and the entry is left out.
 * Unknown fields are ignored. The returned file holds only valid entries.
 */
export function parseRulesFile(input: string): ParseResult {
	if (Buffer.byteLength(input, 'utf8') > MAX_FILE_BYTES) {
		return { ok: false, error: 'The file is larger than 2 MB.' };
	}
	let data: unknown;
	try {
		data = JSON.parse(input.charCodeAt(0) === 0xfeff ? input.slice(1) : input);
	} catch {
		return { ok: false, error: 'The file is not valid JSON.' };
	}
	if (!isObject(data) || data.format !== RULES_FORMAT) {
		return { ok: false, error: `Not a Hearth rules file (format must be "${RULES_FORMAT}").` };
	}
	if (data.version !== RULES_VERSION) {
		return {
			ok: false,
			error: `Unsupported version ${JSON.stringify(data.version)}; this app reads version ${RULES_VERSION}.`
		};
	}
	if (!Array.isArray(data.rules)) return { ok: false, error: '"rules" must be a list.' };
	const rawCategories = data.categories ?? [];
	if (!Array.isArray(rawCategories)) return { ok: false, error: '"categories" must be a list.' };
	if (data.rules.length > MAX_RULES) {
		return { ok: false, error: `The file has more than ${MAX_RULES} rules.` };
	}
	if (rawCategories.length > MAX_CATEGORIES) {
		return { ok: false, error: `The file has more than ${MAX_CATEGORIES} categories.` };
	}

	const invalid: InvalidEntry[] = [];
	const categories: FileCategory[] = [];
	const slugs = new Set<string>();
	rawCategories.forEach((raw, i) => {
		const r = parseCategory(raw);
		if (!r.value) {
			invalid.push({ kind: 'category', index: i + 1, label: r.label, reason: r.reason! });
		} else if (slugs.has(r.value.slug)) {
			invalid.push({
				kind: 'category',
				index: i + 1,
				label: r.label,
				reason: 'Duplicate category slug in the file.'
			});
		} else {
			slugs.add(r.value.slug);
			categories.push(r.value);
		}
	});
	const rules: FileRule[] = [];
	const keys = new Map<string, number>();
	data.rules.forEach((raw, i) => {
		const r = parseRule(raw);
		if (!r.value) {
			invalid.push({ kind: 'rule', index: i + 1, label: r.label, reason: r.reason! });
			return;
		}
		const key = ruleKey(r.value.pattern, r.value.matchType);
		const first = keys.get(key);
		if (first !== undefined) {
			invalid.push({
				kind: 'rule',
				index: i + 1,
				label: r.label,
				reason: `Duplicate of rule ${first} in the file (same pattern and match type).`
			});
			return;
		}
		keys.set(key, i + 1);
		rules.push(r.value);
	});
	return {
		ok: true,
		invalid,
		file: {
			format: RULES_FORMAT,
			version: RULES_VERSION,
			exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt.slice(0, 40) : '',
			categories,
			rules
		}
	};
}

// ---------------------------------------------------------------- planning

export interface LocalRule {
	id: number;
	pattern: string;
	matchType: FileRule['matchType'];
	direction: FileRule['direction'];
	categorySlug: string;
	person: string | null;
	priority: number;
	isActive: boolean;
}

export interface LocalState {
	rules: LocalRule[];
	categorySlugs: Set<string>;
	people: Set<string>;
}

export interface PlanItem {
	rule: FileRule;
	/** The local rule with the same pattern and match type (identical and conflict only). */
	existing?: LocalRule;
	/** Human-readable differences (conflict only). */
	differences?: string[];
	/** The category does not exist locally but the file defines it. */
	needsCategory?: boolean;
}

export interface ImportPlan {
	newRules: PlanItem[];
	identical: PlanItem[];
	conflicts: PlanItem[];
	/** Rules (not existing yet) whose category is missing locally but defined by the file. */
	missingCategory: PlanItem[];
	/** Entries that cannot be imported (from the file itself or from the local data). */
	invalid: InvalidEntry[];
	/** Definitions of the missing categories that importable rules need. */
	categoriesToCreate: FileCategory[];
}

const directionLabel = { any: 'any direction', in: 'money in', out: 'money out' } as const;

/** Compares an imported rule with the local one; priority alone is never a difference. */
export function differences(rule: FileRule, local: LocalRule): string[] {
	const out: string[] = [];
	if (rule.categorySlug !== local.categorySlug) {
		out.push(`category ${local.categorySlug} → ${rule.categorySlug}`);
	}
	if (rule.direction !== local.direction) {
		out.push(`direction ${directionLabel[local.direction]} → ${directionLabel[rule.direction]}`);
	}
	if (rule.person !== local.person) {
		out.push(`person ${local.person ?? 'nobody'} → ${rule.person ?? 'nobody'}`);
	}
	if (rule.isActive !== local.isActive) {
		out.push(
			`${local.isActive ? 'active' : 'inactive'} → ${rule.isActive ? 'active' : 'inactive'}`
		);
	}
	return out;
}

/**
 * Classifies every rule of a (syntactically valid) file against the local state. Pure: nothing
 * is written. Same input always gives the same plan, which is what lets the confirm step
 * re-diff on the server instead of trusting the preview.
 */
export function planImport(file: RulesFile, local: LocalState): ImportPlan {
	const byKey = new Map(local.rules.map((r) => [ruleKey(r.pattern, r.matchType), r]));
	const defs = new Map(file.categories.map((c) => [c.slug, c]));
	const plan: ImportPlan = {
		newRules: [],
		identical: [],
		conflicts: [],
		missingCategory: [],
		invalid: [],
		categoriesToCreate: []
	};
	const needed = new Set<string>();
	file.rules.forEach((rule, i) => {
		const invalid = (reason: string) =>
			plan.invalid.push({ kind: 'rule', index: i + 1, label: rule.pattern, reason });
		if (rule.person !== null && !local.people.has(rule.person)) {
			invalid(`Unknown person "${rule.person}" (add them to this install first).`);
			return;
		}
		const categoryLocal = local.categorySlugs.has(rule.categorySlug);
		const definition = defs.get(rule.categorySlug);
		const existing = byKey.get(ruleKey(rule.pattern, rule.matchType));
		if (existing) {
			const diff = differences(rule, existing);
			if (diff.length === 0) {
				plan.identical.push({ rule, existing });
				return;
			}
			if (!categoryLocal && !definition) {
				invalid(
					`Category "${rule.categorySlug}" does not exist here and the file does not define it.`
				);
				return;
			}
			if (!categoryLocal) needed.add(rule.categorySlug);
			plan.conflicts.push({ rule, existing, differences: diff, needsCategory: !categoryLocal });
			return;
		}
		if (categoryLocal) {
			plan.newRules.push({ rule });
		} else if (definition) {
			needed.add(rule.categorySlug);
			plan.missingCategory.push({ rule, needsCategory: true });
		} else {
			invalid(
				`Category "${rule.categorySlug}" does not exist here and the file does not define it.`
			);
		}
	});
	plan.categoriesToCreate = [...needed].map((s) => defs.get(s)!);
	return plan;
}

export interface PriorityAssignment {
	rule: FileRule;
	priority: number;
}

/**
 * Priorities for new rules. An imported priority is kept when no EXISTING rule uses it (rules of
 * the file may share a priority among themselves, exactly as they did where they came from);
 * otherwise the rule is appended after the highest priority in use, in steps of 10, keeping the
 * relative order of the file (priority, then position in the file). Rules without a priority
 * are appended the same way.
 */
export function assignPriorities(
	rules: FileRule[],
	existingPriorities: Iterable<number>
): PriorityAssignment[] {
	const taken = new Set(existingPriorities);
	const order = rules
		.map((rule, i) => ({ rule, i }))
		.sort((a, b) => (a.rule.priority ?? Infinity) - (b.rule.priority ?? Infinity) || a.i - b.i);
	const result = new Map<FileRule, number>();
	const appended: FileRule[] = [];
	for (const { rule } of order) {
		if (rule.priority !== null && !taken.has(rule.priority)) result.set(rule, rule.priority);
		else appended.push(rule);
	}
	let next = Math.max(0, ...taken, ...result.values()) + 10;
	for (const rule of appended) {
		result.set(rule, Math.min(next, MAX_PRIORITY));
		next += 10;
	}
	return rules.map((rule) => ({ rule, priority: result.get(rule)! }));
}
