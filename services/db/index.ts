import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import { relations } from './relations';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const IS_E2E = process.env.E2E === 'true';
const connectionMax =
  process.env.DB_MIGRATING || process.env.DB_SEEDING
    ? 1
    : IS_E2E
      ? 2
      : undefined;

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    max: connectionMax,
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  relations,
  logger: false,
});
