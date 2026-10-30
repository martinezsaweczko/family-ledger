// Usage: node e2e/seed-cli.ts <database-url> [--empty]. Seeds the SYNTHETIC dataset only.
import { seedSynthetic } from './synthetic.ts';

const [url, flag] = process.argv.slice(2);
if (!url) throw new Error('database url required');
await seedSynthetic(url, flag === '--empty' ? [] : undefined);
console.log('[seed] synthetic data written');
