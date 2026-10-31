import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional text variable: empty counts as unset. */
const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'MySQL connection URL, e.g. mysql://user:pass@host:3306/db',
		schema: (value) => {
			if (!value) throw new Error('DATABASE_URL is required');
			return value;
		}
	},
	AI_BASE_URL: {
		description:
			'Base URL of an OpenAI-compatible chat-completions service (POST <base>/v1/chat/completions). AI categorisation is disabled when unset.',
		schema: optional
	},
	AI_MODEL: {
		description: 'Model name sent to the AI service (default: haiku)',
		schema: optional
	},
	AI_API_KEY: {
		description: 'Optional bearer token for the AI service',
		schema: optional
	},
	AI_TIMEOUT_MS: {
		description: 'Per-request timeout for the AI service in milliseconds (default: 30000)',
		schema: optional
	},
	AI_MIN_CONFIDENCE: {
		description: 'Minimum confidence (0-1) to accept an AI category (default: 0.6)',
		schema: optional
	}
});
