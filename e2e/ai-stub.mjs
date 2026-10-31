// Tiny stand-in for the internal AI service (OpenAI-compatible chat completions), used only by the
// Playwright run. It answers deterministically and records the prompts it receives so tests can
// assert what was (not) sent. Never reaches the network.
import { createServer } from 'node:http';

export const AI_STUB_PORT = Number(process.env.AI_STUB_PORT ?? 4199);

/** @type {string[]} */
let prompts = [];

/** @param {string} prompt */
function answerFor(prompt) {
	const items = prompt
		.split('\n')
		.map((l) => /^(\d+) \| (.*) \| (in|out) \| (\d+)$/.exec(l))
		.filter(Boolean);
	return items.map((m) => {
		const text = m[2];
		if (/BISTRO/.test(text)) return { id: Number(m[1]), category: 'eating-out', confidence: 0.82 };
		return { id: Number(m[1]), category: null, confidence: 0.1 };
	});
}

const server = createServer((req, res) => {
	const send = (code, body) => {
		res.writeHead(code, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	if (req.method === 'GET' && req.url === '/__log') return send(200, { prompts });
	if (req.method === 'POST' && req.url === '/__reset') {
		prompts = [];
		return send(200, {});
	}
	if (req.method === 'POST' && req.url === '/v1/chat/completions') {
		let raw = '';
		req.on('data', (c) => (raw += c));
		req.on('end', () => {
			try {
				const prompt = JSON.parse(raw).messages?.[0]?.content ?? '';
				prompts.push(prompt);
				const content = '```json\n' + JSON.stringify(answerFor(prompt)) + '\n```';
				send(200, {
					id: 'stub',
					object: 'chat.completion',
					choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }]
				});
			} catch {
				send(400, { error: 'bad request' });
			}
		});
		return;
	}
	send(404, { error: 'not found' });
});

server.listen(AI_STUB_PORT, '127.0.0.1', () =>
	console.log(`[ai-stub] listening on ${AI_STUB_PORT}`)
);
