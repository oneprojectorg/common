import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import { buildPoolOptions } from './poolOptions';
import { relations } from './relations';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    ...buildPoolOptions(process.env),
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  relations,
  logger: false,
});
