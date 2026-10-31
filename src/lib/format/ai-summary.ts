/** Outcome of one AI categorisation run (shared by the server and the admin UI). */
export interface AiResult {
	enabled: boolean;
	/** Uncategorised rows considered. */
	requested: number;
	categorised: number;
	/** Rows the model declined, was not confident about, or answered inconsistently. */
	skipped: number;
	/** Rows whose request failed (timeout, HTTP error, unusable reply) or that ran out of time. */
	failed: number;
}

/** One-line summary, e.g. "AI categorised 31 of 36 uncategorised rows." */
export function describeAiResult(r: AiResult): string {
	if (!r.enabled) return 'AI categorisation is not configured.';
	if (r.requested === 0) return 'No uncategorised rows to send to the AI.';
	const parts = [`AI categorised ${r.categorised} of ${r.requested} uncategorised rows`];
	if (r.failed) parts.push(`${r.failed} could not be processed`);
	return `${parts.join('. ')}.`;
}
