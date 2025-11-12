import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import * as schema from './schema';

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  path: '../../.env.local',
});

// For local development with git worktrees, we need to load the .env.local file from the root *bare* repository
dotenv.config({
  path: '../../../.env.local',
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    max: process.env.DB_MIGRATING || process.env.DB_SEEDING ? 1 : undefined,
    onnotice: process.env.DB_SEEDING ? () => {} : undefined,
    prepare: false,
  },
  casing: config.casing,
  schema,
  logger: process.env.NODE_ENV !== 'test',
});
