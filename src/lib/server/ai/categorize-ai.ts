import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { describeAiResult, type AiResult } from '#lib/format/ai-summary.ts';
import { getDb, type Db } from '../db/index.ts';
import { categories, statements } from '../db/schema.ts';
import { cleanMerchant } from '../importers/merchant.ts';
import { chatCompletion, AiError } from './client.ts';
import { getAiConfig, type AiConfig } from './config.ts';
import { recordAiRun } from './status.ts';
import {
	buildPrompt,
	parseAiReply,
	sanitizeConcept,
	type AiAnswer,
	type PromptCategory,
	type PromptItem
} from './prompt.ts';

/** Distinct merchants per request. */
export const BATCH_SIZE = 20;
/** Bounds for one automatic run (after an import, or one click on the review button). */
export const MAX_ROWS = 200;
export const MAX_TOTAL_MS = 60_000;
/** An incoming row may take an expense category (refund) only above this confidence. */
export const REFUND_CONFIDENCE = 0.8;

export { describeAiResult, type AiResult };

export const AI_DISABLED: AiResult = {
	enabled: false,
	requested: 0,
	categorised: 0,
	skipped: 0,
	failed: 0
};

export interface AiRunOptions {
	/** Restrict to these statement ids (the new rows of an import). Undefined = every uncategorised row. */
	ids?: number[];
	maxRows?: number;
	maxTotalMs?: number;
	config?: AiConfig | null;
	fetch?: typeof fetch;
	db?: Db;
}

interface Group {
	/** Id sent to the model, local to the request. */
	id: number;
	text: string;
	direction: 'in' | 'out';
	amountEuros: number;
	rowIds: number[];
}

/** Rows with no category and no source: the only ones the AI may touch. */
const untouched = and(isNull(statements.categoryId), isNull(statements.categorySource));

/** Groups rows by cleaned merchant + direction so each merchant is asked once. Rows with no usable text are dropped (skipped). */
export function groupRows(rows: { id: number; concept: string; amountCents: number }[]): {
	groups: Group[];
	unusable: number;
} {
	const byKey = new Map<string, Group & { amounts: number[] }>();
	let unusable = 0;
	for (const r of rows) {
		const direction = r.amountCents > 0 ? 'in' : 'out';
		const text = sanitizeConcept(cleanMerchant(r.concept), direction);
		if (text.replace(/[^\p{L}]/gu, '').length < 2) {
			unusable++;
			continue;
		}
		const key = `${direction}|${text.toLowerCase()}`;
		const g = byKey.get(key) ?? {
			id: 0,
			text,
			direction,
			amountEuros: 0,
			rowIds: [],
			amounts: []
		};
		g.rowIds.push(r.id);
		g.amounts.push(Math.abs(r.amountCents));
		byKey.set(key, g);
	}
	const groups = [...byKey.values()].map((g, i) => {
		const sorted = [...g.amounts].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		return {
			id: i + 1,
			text: g.text,
			direction: g.direction,
			amountEuros: Math.round(median / 100),
			rowIds: g.rowIds
		};
	});
	return { groups, unusable };
}

/**
 * Decides whether an answer is acceptable for a group; returns the category or null.
 * Outgoing rows may not take income categories; incoming rows take income/transfer, or an
 * expense category (a refund) only at high confidence. Unknown slugs are ignored.
 */
export function acceptAnswer(
	answer: AiAnswer | undefined,
	group: Pick<Group, 'direction'>,
	bySlug: Map<string, { id: number; kind: string }>,
	minConfidence: number
): { categoryId: number; confidence: number } | null {
	if (!answer || !answer.category) return null;
	const cat = bySlug.get(answer.category);
	if (!cat) return null;
	if (answer.confidence < minConfidence) return null;
	if (group.direction === 'out' && cat.kind === 'income') return null;
	if (group.direction === 'in' && cat.kind === 'expense' && answer.confidence < REFUND_CONFIDENCE) {
		return null;
	}
	return { categoryId: cat.id, confidence: answer.confidence };
}

/**
 * Asks the AI to categorise still-uncategorised rows. Never throws: any failure leaves the rows
 * untouched and is counted in `failed`. Never overwrites a category (manual, rule or ai), because
 * the write is conditional on the row still being uncategorised.
 */
export async function categorizeWithAi(opts: AiRunOptions = {}): Promise<AiResult> {
	const config = opts.config === undefined ? getAiConfig() : opts.config;
	if (!config) return AI_DISABLED;
	const result: AiResult = { ...AI_DISABLED, enabled: true };
	try {
		const db = opts.db ?? getDb();
		const maxRows = opts.maxRows ?? MAX_ROWS;
		const deadline = Date.now() + (opts.maxTotalMs ?? MAX_TOTAL_MS);
		if (opts.ids && opts.ids.length === 0) return result;

		const rows = await db
			.select({
				id: statements.id,
				concept: statements.concept,
				amountCents: statements.amountCents
			})
			.from(statements)
			.where(and(untouched, opts.ids ? inArray(statements.id, opts.ids) : undefined))
			.orderBy(asc(statements.id))
			.limit(maxRows);
		result.requested = rows.length;
		if (!rows.length) return result;

		const cats = await db
			.select({
				id: categories.id,
				slug: categories.slug,
				name: categories.name,
				kind: categories.kind
			})
			.from(categories)
			.where(eq(categories.isActive, true));
		const usable = cats.filter((c) => c.kind !== 'ignore');
		const bySlug = new Map(usable.map((c) => [c.slug, { id: c.id, kind: c.kind }]));
		const promptCats: PromptCategory[] = usable.map((c) => ({
			slug: c.slug,
			name: c.name,
			kind: c.kind
		}));

		const { groups, unusable } = groupRows(rows);
		result.skipped += unusable;

		for (let i = 0; i < groups.length; i += BATCH_SIZE) {
			const batch = groups.slice(i, i + BATCH_SIZE);
			const rowCount = (gs: Group[]) => gs.reduce((n, g) => n + g.rowIds.length, 0);
			if (Date.now() >= deadline) {
				result.failed += rowCount(groups.slice(i));
				console.warn('[ai] time budget used up; remaining rows left uncategorised');
				break;
			}
			const items: PromptItem[] = batch.map((g, n) => ({
				id: n + 1,
				text: g.text,
				direction: g.direction,
				amountEuros: g.amountEuros
			}));
			let answers: AiAnswer[];
			try {
				const reply = await chatCompletion(
					config,
					[{ role: 'user', content: buildPrompt(promptCats, items) }],
					opts.fetch
				);
				answers = parseAiReply(reply);
			} catch (err) {
				console.warn(
					`[ai] request failed: ${err instanceof AiError ? err.message : 'unexpected error'}`
				);
				result.failed += rowCount(batch);
				continue;
			}
			if (!answers.length) {
				console.warn('[ai] reply had no usable JSON; rows left uncategorised');
				result.failed += rowCount(batch);
				continue;
			}
			const byId = new Map(answers.map((a) => [a.id, a]));
			for (const [n, g] of batch.entries()) {
				const ok = acceptAnswer(byId.get(n + 1), g, bySlug, config.minConfidence);
				if (!ok) {
					result.skipped += g.rowIds.length;
					continue;
				}
				const [res] = await db
					.update(statements)
					.set({
						categoryId: ok.categoryId,
						categorySource: 'ai',
						aiConfidence: Math.round(ok.confidence * 100),
						aiModel: config.model.slice(0, 80)
					})
					.where(and(untouched, inArray(statements.id, g.rowIds)));
				result.categorised += res.affectedRows;
				result.skipped += g.rowIds.length - res.affectedRows;
			}
		}
	} catch (err) {
		console.warn(`[ai] categorisation aborted: ${(err as Error).message}`);
		result.failed = Math.max(result.failed, result.requested - result.categorised - result.skipped);
	}
	recordAiRun(result);
	return result;
}
