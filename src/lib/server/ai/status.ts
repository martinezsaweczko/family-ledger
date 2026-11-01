import { describeAiResult, type AiResult } from '#lib/format/ai-summary.ts';
import { AiError, chatCompletion } from './client.ts';
import { aiHost, getAiConfig, type AiConfig } from './config.ts';
import { buildPrompt, parseAiReply } from './prompt.ts';

export interface AiLastRun {
	at: string;
	summary: string;
}

let last: AiLastRun | null = null;

/** Remembered in memory only (resets on restart); shown on the admin page. */
export function recordAiRun(result: AiResult, now = new Date()): void {
	if (!result.enabled) return;
	last = { at: now.toISOString(), summary: describeAiResult(result) };
}

export function getAiStatus() {
	const cfg = getAiConfig();
	return cfg
		? { enabled: true as const, model: cfg.model, host: aiHost(cfg), last }
		: { enabled: false as const, last };
}

export interface ConnectionTest {
	ok: boolean;
	message: string;
}

/** One harmless request with clearly synthetic text: proves reachability, auth and the reply shape. */
export async function testAiConnection(
	config: AiConfig | null = getAiConfig(),
	fetchImpl?: typeof fetch
): Promise<ConnectionTest> {
	if (!config) return { ok: false, message: 'AI categorisation is not configured.' };
	const started = Date.now();
	try {
		const reply = await chatCompletion(
			config,
			[
				{
					role: 'user',
					content: buildPrompt(
						[
							{ slug: 'supermarket', name: 'Supermarket', kind: 'expense' },
							{ slug: 'eating-out', name: 'Eating out', kind: 'expense' }
						],
						[{ id: 1, text: 'MERCADONA PORT', direction: 'out', amountEuros: 51 }]
					)
				}
			],
			fetchImpl
		);
		const answers = parseAiReply(reply);
		const ms = Date.now() - started;
		return answers.length
			? { ok: true, message: `Connected in ${ms} ms; the model answered with valid JSON.` }
			: { ok: false, message: `Connected in ${ms} ms, but the reply was not the expected JSON.` };
	} catch (err) {
		return {
			ok: false,
			message: err instanceof AiError ? err.message : 'The AI service could not be reached.'
		};
	}
}
