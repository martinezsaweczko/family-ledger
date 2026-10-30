import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'MySQL connection URL, e.g. mysql://user:pass@host:3306/db',
		schema: (value) => {
			if (!value) throw new Error('DATABASE_URL is required');
			return value;
		}
	}
});
