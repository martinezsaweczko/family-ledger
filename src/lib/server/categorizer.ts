export interface Rule {
	pattern: string;
	matchType: 'contains' | 'regex';
	categoryId: number;
	personId: number | null;
	priority: number;
	direction: 'any' | 'in' | 'out';
	isActive: boolean;
}

export interface Categorization {
	categoryId: number;
	personId: number | null;
}

const regexCache = new Map<string, RegExp | null>();

function compile(pattern: string): RegExp | null {
	let re = regexCache.get(pattern);
	if (re === undefined) {
		try {
			re = new RegExp(pattern, 'i');
		} catch {
			re = null; // invalid user-supplied regex: the rule never matches
		}
		regexCache.set(pattern, re);
	}
	return re;
}

function matches(rule: Rule, concept: string, amountCents: number): boolean {
	if (rule.direction === 'in' && amountCents <= 0) return false;
	if (rule.direction === 'out' && amountCents >= 0) return false;
	if (rule.matchType === 'contains')
		return concept.toLowerCase().includes(rule.pattern.toLowerCase());
	return compile(rule.pattern)?.test(concept) ?? false;
}

/** Sort once (lowest priority number first, stable) and reuse for many rows. */
export function sortRules(rules: Rule[]): Rule[] {
	return [...rules].sort((a, b) => a.priority - b.priority);
}

/**
 * Pure rule engine: first matching active rule by priority wins.
 * Manual categories are protected by the callers (they never pass such rows in).
 */
export function categorize(
	concept: string,
	amountCents: number,
	rules: Rule[],
	{ presorted = false }: { presorted?: boolean } = {}
): Categorization | null {
	const text = concept.replace(/\s+/g, ' ').trim();
	for (const rule of presorted ? rules : sortRules(rules)) {
		if (rule.isActive && matches(rule, text, amountCents)) {
			return { categoryId: rule.categoryId, personId: rule.personId };
		}
	}
	return null;
}
