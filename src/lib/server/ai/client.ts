import type { AiConfig } from './config.ts';

export class AiError extends Error {
	constructor(
		message: string,
		readonly kind: 'timeout' | 'http' | 'network' | 'shape'
	) {
		super(message);
	}
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/** Pulls the assistant text out of an OpenAI-style response; tolerant about extra or missing fields. */
export function extractContent(body: unknown): string | null {
	const choice = (body as { choices?: unknown[] } | null)?.choices?.[0] as
		{ message?: { content?: unknown }; text?: unknown } | undefined;
	const content = choice?.message?.content ?? choice?.text;
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		const text = content
			.map((part) => (typeof part === 'string' ? part : (part as { text?: unknown })?.text))
			.filter((t): t is string => typeof t === 'string')
			.join('');
		return text || null;
	}
	return null;
}

/**
 * One non-streaming chat-completions call (`POST <base>/v1/chat/completions`) with a hard
 * timeout. Throws AiError; never returns partial output.
 */
export async function chatCompletion(
	config: AiConfig,
	messages: ChatMessage[],
	fetchImpl: typeof fetch = fetch
): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), config.timeoutMs);
	try {
		const headers: Record<string, string> = {
			accept: 'application/json',
			'Content-Type': 'application/json'
		};
		if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
		const res = await fetchImpl(`${config.baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ messages, model: config.model, stream: false, temperature: 0 }),
			signal: controller.signal
		});
		if (!res.ok) throw new AiError(`AI service answered HTTP ${res.status}`, 'http');
		let body: unknown;
		try {
			body = await res.json();
		} catch {
			throw new AiError('AI service did not return JSON', 'shape');
		}
		const content = extractContent(body);
		if (content === null) throw new AiError('AI response had no message content', 'shape');
		return content;
	} catch (err) {
		if (err instanceof AiError) throw err;
		if (controller.signal.aborted) {
			throw new AiError(`AI request timed out after ${config.timeoutMs} ms`, 'timeout');
		}
		throw new AiError(`AI request failed: ${(err as Error).message}`, 'network');
	} finally {
		clearTimeout(timer);
	}
}
