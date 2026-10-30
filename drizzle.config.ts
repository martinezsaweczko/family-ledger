import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'mysql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL ?? 'mysql://hearth:hearth@127.0.0.1:3306/hearth' }
});
