import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  path: '../../.env.local',
});

// For local development with git worktrees, we need to load the .env.local file from the root *bare* repository
dotenv.config({
  path: '../../../.env.local',
});

export default defineConfig({
  schema: './schema/publicTables.ts',
  out: './migrations',
  schemaFilter: ['public'],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: 'migrations',
    schema: 'drizzle',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
