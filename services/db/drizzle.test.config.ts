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

// Test database configuration - uses test instance port
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

export default defineConfig({
  schema: './schema/publicTables.ts',
  out: './migrations',
  schemaFilter: ['public'],
  dialect: 'postgresql',
  extensionsFilters: ['postgis'],
  dbCredentials: {
    url: TEST_DATABASE_URL,
  },
  migrations: {
    table: 'migrations',
    schema: 'drizzle',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});