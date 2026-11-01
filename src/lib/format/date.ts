/**
 * Dates are stored and exchanged as ISO `YYYY-MM-DD`; people see and type `dd/mm/yyyy`.
 * Month-only labels stay English (`Oct 2026`). No Intl here: output must not depend on ICU data.
 */
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

const ISO_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const pad = (n: number) => String(n).padStart(2, '0');

export function isRealDate(year: number, month: number, day: number): boolean {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12 || day < 1) return false;
	return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `2026-10-30` (or a timestamp starting with it) -> `30/10/2026`; anything else is returned as-is. */
export function formatDate(iso: string): string {
	const m = ISO_PREFIX.exec(iso);
	return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Day label for axes: `30/10`. */
export function formatDayMonth(iso: string): string {
	const m = ISO_PREFIX.exec(iso);
	return m ? `${m[3]}/${m[2]}` : iso;
}

/** `Oct 2026`, or `October 2026` with `style: 'long'`. */
export function formatMonthYear(iso: string, style: 'short' | 'long' = 'short'): string {
	const m = ISO_PREFIX.exec(iso);
	if (!m) return iso;
	const name = MONTHS[Number(m[2]) - 1];
	return `${style === 'long' ? name : name.slice(0, 3)} ${m[1]}`;
}

/** `30/10/2026 14:05` from a Date (local time) or a `YYYY-MM-DD HH:mm:ss` string. */
export function formatDateTime(value: Date | string): string {
	if (value instanceof Date) {
		return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
	}
	if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return formatDateTime(new Date(value));
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
	return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : formatDate(value);
}

const ISO_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const EURO = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** Shared parser: ISO `YYYY-MM-DD` or `d/m/yyyy` (`.` and `-` also accepted) -> ISO, or null. */
export function parseDate(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const s = value.trim();
	let y: number, mo: number, d: number;
	let m = ISO_ONLY.exec(s);
	if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	else if ((m = EURO.exec(s))) [y, mo, d] = [Number(m[3]), Number(m[2]), Number(m[1])];
	else return null;
	if (y < 1000 || !isRealDate(y, mo, d)) return null;
	return `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)}`;
}

/** ISO -> text for an input (`''` stays `''`, invalid text is kept so the user can fix it). */
export function toDisplayDate(iso: string): string {
	return iso ? formatDate(iso) : '';
}

/**
 * Live mask for the visible date field. Keeps digits (max 8), inserts `/` after day and month,
 * pads a lone digit when a separator is typed (`3/` -> `03/`). `deleting` suppresses the
 * trailing slash so backspace works.
 */
export function maskDateInput(raw: string, deleting = false): string {
	const parts: string[] = [''];
	for (const ch of raw) {
		const i = parts.length - 1;
		const max = i === 2 ? 4 : 2;
		if (/\d/.test(ch)) {
			if (parts[i].length >= max) {
				if (i === 2) continue;
				parts.push('');
				parts[i + 1] += ch;
			} else parts[i] += ch;
		} else if (/[/.\-\s]/.test(ch) && i < 2 && parts[i].length > 0) {
			if (parts[i].length === 1) parts[i] = `0${parts[i]}`;
			parts.push('');
		}
	}
	let out = parts.join('/');
	const last = parts.length - 1;
	if (!deleting && last < 2 && parts[last].length === 2 && !out.endsWith('/')) out += '/';
	return out;
}
