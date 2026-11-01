import { describe, expect, it, vi } from 'vitest';
import { AiError, chatCompletion, extractContent } from './client.ts';
import { aiHost, parseAiConfig, type AiConfig } from './config.ts';

const cfg: AiConfig = {
	baseUrl: 'https://ai.example.test',
	model: 'haiku',
	timeoutMs: 1000,
	minConfidence: 0.6
};
const ok = (content: unknown) =>
	new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
const messages = [{ role: 'user' as const, content: 'hi' }];

describe('parseAiConfig', () => {
	it('is disabled without a base URL or with a bad one', () => {
		expect(parseAiConfig({})).toBeNull();
		expect(parseAiConfig({ AI_BASE_URL: '  ' })).toBeNull();
		expect(parseAiConfig({ AI_BASE_URL: 'not a url' })).toBeNull();
		expect(parseAiConfig({ AI_BASE_URL: 'ftp://x.test' })).toBeNull();
	});
	it('applies defaults and normalises the URL', () => {
		const c = parseAiConfig({ AI_BASE_URL: 'https://ai.example.test/' })!;
		expect(c).toMatchObject({
			baseUrl: 'https://ai.example.test',
			model: 'haiku',
			timeoutMs: 30000,
			minConfidence: 0.6
		});
		expect(c.apiKey).toBeUndefined();
		expect(aiHost(c)).toBe('ai.example.test');
	});
	it('reads overrides and ignores nonsense numbers', () => {
		const c = parseAiConfig({
			AI_BASE_URL: 'http://10.0.0.5:8080/proxy/',
			AI_MODEL: 'sonnet',
			AI_API_KEY: 'k',
			AI_TIMEOUT_MS: '5000',
			AI_MIN_CONFIDENCE: '9'
		})!;
		expect(c).toMatchObject({
			baseUrl: 'http://10.0.0.5:8080/proxy',
			model: 'sonnet',
			apiKey: 'k',
			timeoutMs: 5000,
			minConfidence: 0.6
		});
		expect(aiHost(c)).toBe('10.0.0.5:8080');
	});
});

describe('chatCompletion', () => {
	it('posts the OpenAI chat-completions shape and returns the message text', async () => {
		const fetchMock = vi.fn(async () => ok('[]'));
		await expect(chatCompletion(cfg, messages, fetchMock as unknown as typeof fetch)).resolves.toBe(
			'[]'
		);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://ai.example.test/v1/chat/completions');
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string);
		expect(body).toEqual({ messages, model: 'haiku', stream: false, temperature: 0 });
		const headers = init.headers as Record<string, string>;
		expect(headers['Content-Type']).toBe('application/json');
		expect(headers.Authorization).toBeUndefined();
	});
	it('sends a bearer token only when a key is configured', async () => {
		const fetchMock = vi.fn(async () => ok('x'));
		await chatCompletion(
			{ ...cfg, apiKey: 'secret' },
			messages,
			fetchMock as unknown as typeof fetch
		);
		const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
	});
	it('maps HTTP errors, bad JSON and missing content to AiError', async () => {
		const f = (r: Response) => (async () => r) as unknown as typeof fetch;
		await expect(
			chatCompletion(cfg, messages, f(new Response('no', { status: 503 })))
		).rejects.toMatchObject({ kind: 'http' });
		await expect(
			chatCompletion(cfg, messages, f(new Response('<html>', { status: 200 })))
		).rejects.toMatchObject({ kind: 'shape' });
		await expect(
			chatCompletion(cfg, messages, f(Response.json({ choices: [] })))
		).rejects.toMatchObject({ kind: 'shape' });
	});
	it('maps network failures and times out hung requests', async () => {
		const down = (async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		await expect(chatCompletion(cfg, messages, down)).rejects.toMatchObject({ kind: 'network' });
		const hang = ((_u: string, init: RequestInit) =>
			new Promise((_res, rej) =>
				init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
			)) as unknown as typeof fetch;
		const err = await chatCompletion({ ...cfg, timeoutMs: 20 }, messages, hang).catch((e) => e);
		expect(err).toBeInstanceOf(AiError);
		expect(err.kind).toBe('timeout');
	});
});

describe('extractContent', () => {
	it('is defensive about the response shape', () => {
		expect(extractContent({ choices: [{ message: { content: 'a' } }] })).toBe('a');
		expect(extractContent({ choices: [{ text: 'b' }] })).toBe('b');
		expect(extractContent({ choices: [{ message: { content: [{ text: 'c' }, 'd'] } }] })).toBe(
			'cd'
		);
		expect(extractContent(null)).toBeNull();
		expect(extractContent({})).toBeNull();
		expect(extractContent({ choices: [{ message: {} }] })).toBeNull();
	});
});
