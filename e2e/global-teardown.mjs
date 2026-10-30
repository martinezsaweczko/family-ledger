import { dropE2eDb } from './db.mjs';

export default async function globalTeardown() {
	await dropE2eDb();
}
