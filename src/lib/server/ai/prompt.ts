/**
 * Prompt building and reply parsing for the AI categoriser.
 *
 * PRIVACY: the only data that ever leaves the server is a cleaned merchant text, the direction
 * (in/out) and the amount rounded to whole euros. Never the IBAN, balance, account, dates, raw
 * concept, or any digit sequence.
 */
export interface PromptCategory {
	slug: string;
	name: string;
	kind: string;
}

export interface PromptItem {
	id: number;
	/** Cleaned merchant text (see `sanitizeConcept`). */
	text: string;
	direction: 'in' | 'out';
	/** Absolute amount in whole euros. */
	amountEuros: number;
}

const IBAN_LIKE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
const MAX_TEXT = 60;

/**
 * Makes a cleaned merchant name safe to send: drops IBAN-like tokens, every digit, long
 * punctuation runs, and, for incoming rows, the sender's name that follows " DE " in a transfer.
 */
export function sanitizeConcept(text: string, direction: 'in' | 'out'): string {
	let t = text.replace(IBAN_LIKE, ' ');
	if (direction === 'in') t = t.replace(/\bDE\s+.*$/i, ' ');
	t = t
		.replace(/\d+/g, ' ')
		.replace(/[*#_=|\\/]+/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '');
	return t.slice(0, MAX_TEXT).trim();
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function buildPrompt(categories: PromptCategory[], items: PromptItem[]): string {
	const cats = categories.map((c) => `- ${c.slug} | ${oneLine(c.name)} | ${c.kind}`).join('\n');
	const rows = items
		.map((i) => `${i.id} | ${oneLine(i.text) || '(no text)'} | ${i.direction} | ${i.amountEuros}`)
		.join('\n');
	return [
		'You categorise bank transactions of a household. Reply ONLY with a JSON array, no prose, no markdown.',
		'Each element: {"id": <item id>, "category": "<category slug>" or null, "confidence": <number from 0 to 1>}.',
		'Use null as category when you are not sure. Use only slugs from the category list. Answer for every item.',
		'Direction "in" is money received (use an income or transfer category); "out" is money spent.',
		'',
		'Categories (slug | name | kind):',
		cats,
		'',
		'Items (id | merchant text | direction | amount in whole euros):',
		rows
	].join('\n');
}

export interface AiAnswer {
	id: number;
	category: string | null;
	/** 0..1 */
	confidence: number;
}

/** Candidates for the JSON payload inside a reply: whole text, fenced blocks, outermost [..] and {..}. */
function candidates(reply: string): string[] {
	const out = [reply.trim()];
	for (const m of reply.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) out.push(m[1].trim());
	const a = reply.indexOf('['),
		b = reply.lastIndexOf(']');
	if (a >= 0 && b > a) out.push(reply.slice(a, b + 1));
	const c = reply.indexOf('{'),
		d = reply.lastIndexOf('}');
	if (c >= 0 && d > c) out.push(reply.slice(c, d + 1));
	return out;
}

function toList(value: unknown): unknown[] | null {
	if (Array.isArray(value)) return value;
	if (value && typeof value === 'object') {
		const arr = Object.values(value).find(Array.isArray);
		if (arr) return arr as unknown[];
	}
	return null;
}

function toConfidence(v: unknown): number {
	const n = typeof v === 'string' ? Number(v) : v;
	if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
	const scaled = n > 1 && n <= 100 ? n / 100 : n;
	return Math.min(1, Math.max(0, scaled));
}

/** Tolerant parser: never throws, returns whatever well-formed answers it can find. */
export function parseAiReply(reply: string): AiAnswer[] {
	for (const text of candidates(reply)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			continue;
		}
		const list = toList(parsed);
		if (!list) continue;
		const answers: AiAnswer[] = [];
		const seen = new Set<number>();
		for (const el of list) {
			if (!el || typeof el !== 'object') continue;
			const e = el as Record<string, unknown>;
			const id = typeof e.id === 'string' ? Number(e.id) : e.id;
			if (typeof id !== 'number' || !Number.isInteger(id) || seen.has(id)) continue;
			seen.add(id);
			const cat = typeof e.category === 'string' ? e.category.trim().toLowerCase() : null;
			answers.push({ id, category: cat || null, confidence: toConfidence(e.confidence) });
		}
		return answers;
	}
	return [];
}
