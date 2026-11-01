/**
 * Curated category icon registry. Hand-written inline SVG data in the Lucide style
 * (24x24 viewBox, 2px round strokes, `currentColor`), so there is no icon dependency
 * and only the icons listed here ship. Keys are what the `categories.icon` column stores.
 */
export type IconNode =
	| readonly ['path', { d: string }]
	| readonly ['circle', { cx: number; cy: number; r: number }]
	| readonly ['rect', { x: number; y: number; width: number; height: number; rx?: number }];

export interface IconDef {
	label: string;
	nodes: readonly IconNode[];
}

const p = (d: string): IconNode => ['path', { d }];
const c = (cx: number, cy: number, r: number): IconNode => ['circle', { cx, cy, r }];
const r = (x: number, y: number, width: number, height: number, rx?: number): IconNode => [
	'rect',
	{ x, y, width, height, rx }
];

export const ICONS = {
	'shopping-basket': {
		label: 'Shopping basket',
		nodes: [
			p('m15 11-1 9'),
			p('m19 11-4-7'),
			p('M2 11h20'),
			p('m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4'),
			p('M4.5 15.5h15'),
			p('m5 11 4-7'),
			p('m9 11 1 9')
		]
	},
	clapperboard: {
		label: 'Clapperboard',
		nodes: [
			p('M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z'),
			p('m6.2 5.3 3.1 3.9'),
			p('m12.4 3.4 3.1 4'),
			p('M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z')
		]
	},
	repeat: {
		label: 'Repeat',
		nodes: [
			p('m17 2 4 4-4 4'),
			p('M3 11v-1a4 4 0 0 1 4-4h14'),
			p('m7 22-4-4 4-4'),
			p('M21 13v1a4 4 0 0 1-4 4H3')
		]
	},
	'paw-print': {
		label: 'Paw print',
		nodes: [
			c(11, 4, 2),
			c(18, 8, 2),
			c(20, 16, 2),
			p(
				'M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'
			)
		]
	},
	zap: {
		label: 'Lightning bolt',
		nodes: [
			p(
				'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'
			)
		]
	},
	car: {
		label: 'Car',
		nodes: [
			p(
				'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'
			),
			c(7, 17, 2),
			p('M9 17h6'),
			c(17, 17, 2)
		]
	},
	bike: {
		label: 'Bike',
		nodes: [c(18.5, 17.5, 3.5), c(5.5, 17.5, 3.5), c(15, 5, 1), p('M12 17.5V14l-3-3 4-3 2 3h2')]
	},
	house: {
		label: 'House',
		nodes: [
			p('M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'),
			p(
				'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
			)
		]
	},
	'heart-pulse': {
		label: 'Heart with pulse',
		nodes: [
			p(
				'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
			),
			p('M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27')
		]
	},
	bus: {
		label: 'Bus',
		nodes: [
			p('M8 6v6'),
			p('M15 6v6'),
			p('M2 12h19.6'),
			p(
				'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3'
			),
			c(7, 18, 2),
			p('M9 18h5'),
			c(16, 18, 2)
		]
	},
	utensils: {
		label: 'Fork and knife',
		nodes: [
			p('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2'),
			p('M7 2v20'),
			p('M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7')
		]
	},
	'shopping-bag': {
		label: 'Shopping bag',
		nodes: [
			p('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'),
			p('M3 6h18'),
			p('M16 10a4 4 0 0 1-8 0')
		]
	},
	plane: {
		label: 'Plane',
		nodes: [
			p(
				'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'
			)
		]
	},
	banknote: {
		label: 'Banknote',
		nodes: [r(2, 6, 20, 12, 2), c(12, 12, 2), p('M6 12h.01M18 12h.01')]
	},
	send: {
		label: 'Send',
		nodes: [
			p(
				'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z'
			),
			p('m21.854 2.147-10.94 10.939')
		]
	},
	receipt: {
		label: 'Receipt',
		nodes: [
			p('M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z'),
			p('M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'),
			p('M12 17.5v-11')
		]
	},
	'shield-check': {
		label: 'Shield with check',
		nodes: [
			p(
				'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'
			),
			p('m9 12 2 2 4-4')
		]
	},
	'graduation-cap': {
		label: 'Graduation cap',
		nodes: [
			p(
				'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z'
			),
			p('M22 10v6'),
			p('M6 12.5V16a6 3 0 0 0 12 0v-3.5')
		]
	},
	gift: {
		label: 'Gift',
		nodes: [
			r(3, 8, 18, 4, 1),
			p('M12 8v13'),
			p('M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7'),
			p('M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5')
		]
	},
	wallet: {
		label: 'Wallet',
		nodes: [
			p(
				'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'
			),
			p('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4')
		]
	},
	'circle-plus': {
		label: 'Circle with plus',
		nodes: [c(12, 12, 10), p('M8 12h8'), p('M12 8v8')]
	},
	'arrow-left-right': {
		label: 'Arrows left and right',
		nodes: [p('M8 3 4 7l4 4'), p('M4 7h16'), p('m16 21 4-4-4-4'), p('M20 17H4')]
	},
	tag: {
		label: 'Tag',
		nodes: [
			p(
				'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z'
			),
			c(7.5, 7.5, 0.5)
		]
	},
	coffee: {
		label: 'Coffee',
		nodes: [
			p('M10 2v2'),
			p('M14 2v2'),
			p('M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'),
			p('M6 2v2')
		]
	},
	fuel: {
		label: 'Fuel pump',
		nodes: [
			p('M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5'),
			p('M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16'),
			p('M2 21h13'),
			p('M3 9h11')
		]
	},
	briefcase: {
		label: 'Briefcase',
		nodes: [p('M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'), r(2, 6, 20, 14, 2)]
	},
	landmark: {
		label: 'Bank building',
		nodes: [
			p('M10 18v-7'),
			p(
				'M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z'
			),
			p('M14 18v-7'),
			p('M18 18v-7'),
			p('M3 22h18'),
			p('M6 18v-7')
		]
	},
	music: {
		label: 'Music',
		nodes: [p('M9 18V5l12-2v13'), c(6, 18, 3), c(18, 16, 3)]
	},
	phone: {
		label: 'Phone',
		nodes: [
			p(
				'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384'
			)
		]
	},
	wifi: {
		label: 'Wi-Fi',
		nodes: [
			p('M12 20h.01'),
			p('M2 8.82a15 15 0 0 1 20 0'),
			p('M5 12.859a10 10 0 0 1 14 0'),
			p('M8.5 16.429a5 5 0 0 1 7 0')
		]
	},
	'book-open': {
		label: 'Open book',
		nodes: [
			p('M12 7v14'),
			p(
				'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'
			)
		]
	},
	shirt: {
		label: 'Shirt',
		nodes: [
			p(
				'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'
			)
		]
	},
	wrench: {
		label: 'Wrench',
		nodes: [
			p(
				'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'
			)
		]
	},
	droplet: {
		label: 'Water drop',
		nodes: [
			p(
				'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'
			)
		]
	},
	/** Shown for rows without a category (category_id NULL). Not offered in the picker. */
	'circle-dashed': {
		label: 'Dashed circle',
		nodes: [
			p('M10.1 2.182a10 10 0 0 1 3.8 0'),
			p('M13.9 21.818a10 10 0 0 1-3.8 0'),
			p('M17.609 3.721a10 10 0 0 1 2.69 2.7'),
			p('M2.182 13.9a10 10 0 0 1 0-3.8'),
			p('M20.279 17.609a10 10 0 0 1-2.7 2.69'),
			p('M21.818 10.1a10 10 0 0 1 0 3.8'),
			p('M3.721 6.391a10 10 0 0 1 2.7-2.69'),
			p('M6.391 20.279a10 10 0 0 1-2.69-2.7')
		]
	}
} as const satisfies Record<string, IconDef>;

export type IconKey = keyof typeof ICONS;

/** Icon used for rows without a category. */
export const UNCATEGORISED_ICON: IconKey = 'circle-dashed';
/** Icon used when a category has no (valid) icon and no slug default. */
export const FALLBACK_ICON: IconKey = 'tag';

/** Keys the user may pick, in registry order (the uncategorised marker is internal). */
export const PICKABLE_ICON_KEYS = (Object.keys(ICONS) as IconKey[]).filter(
	(k) => k !== UNCATEGORISED_ICON
);

/** True for keys the user may store on a category (everything except the internal marker). */
export function isPickableIcon(value: unknown): value is IconKey {
	return isIconKey(value) && value !== UNCATEGORISED_ICON;
}

export function isIconKey(value: unknown): value is IconKey {
	return typeof value === 'string' && Object.hasOwn(ICONS, value);
}

/** Default icon per seeded category slug (also used to backfill existing rows). */
export const DEFAULT_ICON_BY_SLUG: Record<string, IconKey> = {
	supermarket: 'shopping-basket',
	'eating-out': 'utensils',
	'rent-housing': 'house',
	utilities: 'zap',
	subscriptions: 'repeat',
	entertainment: 'clapperboard',
	shopping: 'shopping-bag',
	travel: 'plane',
	transport: 'bus',
	car: 'car',
	health: 'heart-pulse',
	pets: 'paw-print',
	education: 'graduation-cap',
	insurance: 'shield-check',
	'taxes-fees': 'receipt',
	'gifts-donations': 'gift',
	'cash-withdrawals': 'banknote',
	'personal-transfers': 'send',
	'salary-contributions': 'wallet',
	'other-income': 'circle-plus',
	'internal-transfer': 'arrow-left-right'
};

/** Resolves what to draw for a stored key (+ slug default) with a safe fallback. */
export function resolveIcon(key: string | null | undefined, slug?: string | null): IconKey {
	if (isIconKey(key)) return key;
	if (slug && Object.hasOwn(DEFAULT_ICON_BY_SLUG, slug)) return DEFAULT_ICON_BY_SLUG[slug];
	return FALLBACK_ICON;
}
