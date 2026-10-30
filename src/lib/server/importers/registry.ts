import { deutscheBankXls } from './deutsche-bank-xls.ts';
import type { Importer } from './types.ts';

/** Register new bank importers here: one file + one line. */
export const importers: Importer[] = [deutscheBankXls];

export function getImporter(id: string): Importer | undefined {
	return importers.find((i) => i.id === id);
}

export function detectImporter(buf: Buffer, filename: string): Importer | undefined {
	return importers.find((i) => i.detect(buf, filename));
}
