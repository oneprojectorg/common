import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import { relations } from './relations';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    // IMPORTANT: postgres-js treats an explicit `max: undefined` as
    // Array(undefined) → length 1, i.e. a single-socket pool. Parallel queries
    // then pipeline onto that one socket, which hangs forever against
    // Supavisor transaction-mode pooling. Keep this as a concrete number so
    // the pool actually has the intended size.
    max:
      process.env.DB_MIGRATING || process.env.DB_SEEDING || process.env.E2E
        ? 1
        : 10,
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  relations,
  logger: false,
});
