import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

export default defineConfig({
  // Table definitions.
  schema: './src/db/schema.ts',

  // Migration SQL files are written.
  out: './drizzle',

  dialect: 'postgresql',

  dbCredentials: { url: process.env.DATABASE_URL! },
});