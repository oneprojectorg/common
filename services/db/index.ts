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
    // Keep a concrete number — postgres-js treats `max: undefined` as a
    // single socket. Migrations/seeding run serial DDL and stay at 1.
    max: process.env.DB_MIGRATING || process.env.DB_SEEDING ? 1 : 10,
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  relations,
  logger: false,
});
