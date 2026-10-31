import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from '#lib/server/csrf.ts';

const form = 'application/x-www-form-urlencoded';
const base = {
	method: 'POST',
	contentType: form,
	origin: 'http://192.168.1.50:3000',
	host: '192.168.1.50:3000'
};

describe('isSameOriginRequest', () => {
	it('allows the same host and port over plain http', () => {
		expect(isSameOriginRequest(base)).toBe(true);
	});
	it('ignores the scheme', () => {
		expect(isSameOriginRequest({ ...base, origin: 'https://192.168.1.50:3000' })).toBe(true);
	});
	it('rejects a different host', () => {
		expect(isSameOriginRequest({ ...base, origin: 'http://evil.example:3000' })).toBe(false);
	});
	it('rejects a different port', () => {
		expect(isSameOriginRequest({ ...base, origin: 'http://192.168.1.50:3001' })).toBe(false);
	});
	it('rejects a missing or empty origin on form posts', () => {
		expect(isSameOriginRequest({ ...base, origin: null })).toBe(false);
		expect(isSameOriginRequest({ ...base, origin: '' })).toBe(false);
	});
	it('rejects the null origin and malformed origins', () => {
		expect(isSameOriginRequest({ ...base, origin: 'null' })).toBe(false);
		expect(isSameOriginRequest({ ...base, origin: 'not a url' })).toBe(false);
	});
	it('rejects a missing host', () => {
		expect(isSameOriginRequest({ ...base, host: null })).toBe(false);
	});
	it.each([
		'multipart/form-data; boundary=x',
		'text/plain',
		'application/x-www-form-urlencoded; charset=utf-8'
	])('checks %s', (contentType) => {
		expect(isSameOriginRequest({ ...base, contentType, origin: 'http://evil.example' })).toBe(
			false
		);
	});
	it('checks a missing content type as a form (browsers can omit it)', () => {
		expect(isSameOriginRequest({ ...base, contentType: null, origin: 'http://evil.example' })).toBe(
			false
		);
	});
	it('does not check JSON bodies', () => {
		expect(
			isSameOriginRequest({
				...base,
				contentType: 'application/json',
				origin: 'http://evil.example'
			})
		).toBe(true);
	});
	it.each(['GET', 'HEAD', 'OPTIONS'])('never checks %s', (method) => {
		expect(isSameOriginRequest({ ...base, method, origin: null })).toBe(true);
	});
	it.each(['PUT', 'PATCH', 'DELETE', 'post'])('checks %s', (method) => {
		expect(isSameOriginRequest({ ...base, method, origin: 'http://evil.example' })).toBe(false);
	});
	it('compares hosts case-insensitively', () => {
		expect(
			isSameOriginRequest({ ...base, origin: 'http://Hearth.LAN:3000', host: 'hearth.lan:3000' })
		).toBe(true);
	});
	it('treats the default port as equal to no port for the scheme', () => {
		expect(isSameOriginRequest({ ...base, origin: 'http://hearth.lan', host: 'hearth.lan' })).toBe(
			true
		);
		expect(
			isSameOriginRequest({ ...base, origin: 'http://hearth.lan:80', host: 'hearth.lan' })
		).toBe(true);
	});
	it('handles IPv6 hosts', () => {
		const v6 = { ...base, origin: 'http://[fd00::1]:3000', host: '[fd00::1]:3000' };
		expect(isSameOriginRequest(v6)).toBe(true);
		expect(isSameOriginRequest({ ...v6, origin: 'http://[fd00::2]:3000' })).toBe(false);
	});
	it('allows trusted origins (any scheme match is exact, case-insensitive)', () => {
		const req = { ...base, origin: 'https://hearth.example.lan' };
		expect(isSameOriginRequest(req)).toBe(false);
		expect(isSameOriginRequest({ ...req, trusted: ['https://Hearth.example.lan'] })).toBe(true);
		expect(isSameOriginRequest({ ...req, trusted: ['https://other.lan'] })).toBe(false);
	});
});
