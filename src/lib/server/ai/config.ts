/** Runtime configuration of the internal AI categoriser. Everything is optional; unset base URL = disabled. */
export interface AiConfig {
	/** Base URL without trailing slash, e.g. https://ai.example.lan */
	baseUrl: string;
	model: string;
	apiKey?: string;
	timeoutMs: number;
	/** 0..1: answers below this confidence are ignored. */
	minConfidence: number;
}

export type AiEnv = Partial<
	Record<'AI_BASE_URL' | 'AI_MODEL' | 'AI_API_KEY' | 'AI_TIMEOUT_MS' | 'AI_MIN_CONFIDENCE', string>
>;

const num = (v: string | undefined, fallback: number, min: number, max: number) => {
	const n = v === undefined || v.trim() === '' ? NaN : Number(v);
	return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

export function parseAiConfig(env: AiEnv): AiConfig | null {
	const raw = env.AI_BASE_URL?.trim();
	if (!raw) return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		console.warn('[ai] AI_BASE_URL is not a valid URL; AI categorisation is disabled');
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	return {
		baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, '')}`,
		model: env.AI_MODEL?.trim() || 'haiku',
		apiKey: env.AI_API_KEY?.trim() || undefined,
		timeoutMs: num(env.AI_TIMEOUT_MS, 30_000, 1_000, 300_000),
		minConfidence: num(env.AI_MIN_CONFIDENCE, 0.6, 0, 1)
	};
}

let configured: AiConfig | null | undefined;

/** Called once at server start with the validated env; tests use explicit configs instead. */
export function configureAi(env: AiEnv): void {
	configured = parseAiConfig(env);
}

/** The active config: set by `configureAi`, else read from process.env. Null = disabled. */
export function getAiConfig(): AiConfig | null {
	return configured !== undefined ? configured : parseAiConfig(process.env as AiEnv);
}

/** For logs and the admin: host only, never the path or credentials. */
export function aiHost(config: AiConfig): string {
	return new URL(config.baseUrl).host;
}
