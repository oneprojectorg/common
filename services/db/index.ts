import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    max: process.env.DB_MIGRATING || process.env.DB_SEEDING ? 1 : undefined,
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  logger:
    process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development',
});
