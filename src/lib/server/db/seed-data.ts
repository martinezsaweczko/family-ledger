export type CategoryKind = 'expense' | 'income' | 'transfer' | 'ignore';

import { DEFAULT_ICON_BY_SLUG } from '../../icons/registry.ts';

export interface SeedCategory {
	slug: string;
	name: string;
	color: string;
	kind: CategoryKind;
	/** Key into the icon registry. */
	icon: string;
}

/** Spanish name the utilities category had before it was renamed (data migration 0002). */
export const LEGACY_UTILITIES_NAME = 'Suministros';

/**
 * Colours are mid/dark tones with >= 3:1 contrast on the white card surface of the
 * Clear Slate palette (DESIGN.md), so they stay legible as chart marks and chips.
 * Order here is the default sort order. "Uncategorised" is deliberately NOT a
 * category: statements without a category have category_id = NULL.
 */
const seedCategoryBase: Omit<SeedCategory, 'icon'>[] = [
	{ slug: 'supermarket', name: 'Supermarket', color: '#0F9488', kind: 'expense' },
	{ slug: 'eating-out', name: 'Eating out', color: '#E08A00', kind: 'expense' },
	{ slug: 'rent-housing', name: 'Rent & housing', color: '#1D4ED8', kind: 'expense' },
	{ slug: 'utilities', name: 'Supplies', color: '#0369A1', kind: 'expense' },
	{ slug: 'subscriptions', name: 'Subscriptions', color: '#4F5BD5', kind: 'expense' },
	{ slug: 'entertainment', name: 'Entertainment', color: '#E11D48', kind: 'expense' },
	{ slug: 'shopping', name: 'Shopping', color: '#A21CAF', kind: 'expense' },
	{ slug: 'travel', name: 'Travel', color: '#0891B2', kind: 'expense' },
	{ slug: 'transport', name: 'Transport', color: '#CA8A04', kind: 'expense' },
	{ slug: 'car', name: 'Car & Motorbike', color: '#475569', kind: 'expense' },
	{ slug: 'health', name: 'Health', color: '#DC2626', kind: 'expense' },
	{ slug: 'pets', name: 'Pets', color: '#B45309', kind: 'expense' },
	{ slug: 'education', name: 'Education', color: '#9333EA', kind: 'expense' },
	{ slug: 'insurance', name: 'Insurance', color: '#3F6212', kind: 'expense' },
	{ slug: 'taxes-fees', name: 'Taxes & fees', color: '#7F1D1D', kind: 'expense' },
	{ slug: 'gifts-donations', name: 'Gifts & donations', color: '#DB2777', kind: 'expense' },
	{ slug: 'cash-withdrawals', name: 'Cash withdrawals', color: '#78716C', kind: 'expense' },
	{
		slug: 'personal-transfers',
		name: 'Personal transfers (Bizum)',
		color: '#0284C7',
		kind: 'expense'
	},
	{
		slug: 'salary-contributions',
		name: 'Salary & contributions',
		color: '#059669',
		kind: 'income'
	},
	{ slug: 'other-income', name: 'Other income', color: '#4D7C0F', kind: 'income' },
	{ slug: 'internal-transfer', name: 'Internal transfer', color: '#64748B', kind: 'transfer' }
];

export const seedCategories: SeedCategory[] = seedCategoryBase.map((c) => ({
	...c,
	icon: DEFAULT_ICON_BY_SLUG[c.slug]
}));

export const seedPeople = ['David', 'Joanna'];

export interface SeedRule {
	pattern: string;
	matchType: 'contains' | 'regex';
	category: string;
	person?: string;
	priority?: number;
	direction?: 'any' | 'in' | 'out';
}

const contains = (category: string, patterns: string[]): SeedRule[] =>
	patterns.map((pattern) => ({ pattern, matchType: 'contains', category }));

/**
 * Starter rules for Spanish merchants. Lower priority number wins.
 * Short or ambiguous tokens (DIA, BP) use word-boundary regexes so they do not
 * match inside words such as "MEDIA" or "BPM".
 * ANUL.EFECTIVO (cash reversal) is mapped to cash-withdrawals, inbound only: it
 * reverses a withdrawal, so it nets against that category instead of inflating income.
 */
export const seedRules: SeedRule[] = [
	{
		pattern: 'TRF\\.EX.*DE DAVID',
		matchType: 'regex',
		category: 'salary-contributions',
		person: 'David',
		priority: 10,
		direction: 'in'
	},
	{
		pattern: 'TRF\\.EX.*DE JOANNA',
		matchType: 'regex',
		category: 'salary-contributions',
		person: 'Joanna',
		priority: 10,
		direction: 'in'
	},
	{
		pattern: 'ANUL.EFECTIVO',
		matchType: 'contains',
		category: 'cash-withdrawals',
		priority: 20,
		direction: 'in'
	},
	...contains('supermarket', ['MERCADONA', 'CONDIS', 'LIDL', 'CARREFOUR', 'ALDI']),
	{ pattern: '\\bDIA\\b', matchType: 'regex', category: 'supermarket' },
	...contains('subscriptions', ['NETFLIX', 'SPOTIFY', 'DISNEY', 'HBO', 'AMAZON PRIME', 'YOUTUBE']),
	...contains('utilities', [
		'DIGI',
		'ENDESA',
		'IBERDROLA',
		'AGUAS',
		'NATURGY',
		'VODAFONE',
		'MOVISTAR',
		'ORANGE'
	]),
	...contains('car', ['REPSOL', 'CEPSA', 'GALP', 'SHELL', 'PARKING', 'ITV']),
	{ pattern: '\\bBP\\b', matchType: 'regex', category: 'car' },
	...contains('travel', ['AIRBNB', 'BOOKING', 'RYANAIR', 'VUELING']),
	...contains('cash-withdrawals', ['REINTEGRO CAJERO']),
	...contains('personal-transfers', ['BIZUM'])
];
