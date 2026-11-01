/**
 * Protocol-agnostic CSRF check for form submissions.
 *
 * SvelteKit's built-in check compares `Origin` with the origin adapter-node derives from the
 * request, and adapter-node defaults the protocol to `https`. On a plain-http LAN deployment every
 * form POST would be rejected, so the built-in check is disabled (`csrf.trustedOrigins: ['*']`)
 * and this equivalent one compares only the host[:port] of `Origin` with the `Host` header.
 */

const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export type CsrfInput = {
	method: string;
	contentType: string | null;
	origin: string | null;
	host: string | null;
	/** Extra full origins accepted as-is (reverse proxies). */
	trusted?: readonly string[];
};

/** Does this request need an origin check? (Kit's scope: unsafe methods with form content types.) */
function needsCheck(method: string, contentType: string | null): boolean {
	if (SAFE_METHODS.includes(method.toUpperCase())) return false;
	const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
	// A missing Content-Type is treated as a form: browsers may omit it on form posts.
	return type === '' || FORM_TYPES.includes(type);
}

/** Lower-cased host[:port] with the scheme's default port removed, or null when unparsable. */
function hostOf(origin: string): string | null {
	try {
		return new URL(origin).host.toLowerCase();
	} catch {
		return null;
	}
}

/** True when the request may proceed. */
export function isSameOriginRequest({
	method,
	contentType,
	origin,
	host,
	trusted = []
}: CsrfInput): boolean {
	if (!needsCheck(method, contentType)) return true;
	if (!origin || origin === 'null') return false;

	const normalised = origin.toLowerCase();
	if (trusted.some((t) => t.trim().replace(/\/$/, '').toLowerCase() === normalised)) return true;

	if (!host) return false;
	const originHost = hostOf(origin);
	if (!originHost) return false;
	// Parse Host with the Origin's scheme so default ports normalise the same way on both sides.
	const scheme = origin.slice(0, origin.indexOf(':'));
	const requestHost = hostOf(`${scheme}://${host}`);
	return requestHost !== null && requestHost === originHost;
}

/** Parses the TRUSTED_ORIGINS env value (comma-separated full origins). */
export function parseTrustedOrigins(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export const CSRF_MESSAGE = 'Cross-site POST form submissions are forbidden';
