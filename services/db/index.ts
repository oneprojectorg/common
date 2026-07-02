import { drizzle } from 'drizzle-orm/postgres-js';

import config from './drizzle.config';
import { relations } from './relations';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const isMaintenance = Boolean(
  process.env.DB_MIGRATING || process.env.DB_SEEDING,
);

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
): number => {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// IMPORTANT: postgres-js treats an explicit `max: undefined` as
// Array(undefined) → length 1, i.e. a single-socket pool. Parallel queries
// then pipeline onto that one socket, which hangs forever against
// Supavisor transaction-mode pooling. Always resolve to a concrete number.
// E2E deliberately gets a real pool too — pinning it to 1 socket starved
// parallel Playwright workers and flaked tests (#1399).
const poolMax = isMaintenance
  ? 1
  : parsePositiveInt(process.env.DB_POOL_MAX, 10);

// Connection-startup parameters sent to Postgres. Skipped under
// DB_MIGRATING/DB_SEEDING so long DDL (CREATE INDEX, ALTER TABLE) and seed
// inserts are not killed by a short request-side timeout.
const startupParameters = isMaintenance
  ? {}
  : {
      statement_timeout: parsePositiveInt(
        process.env.DB_STATEMENT_TIMEOUT_MS,
        30_000,
      ),
      idle_in_transaction_session_timeout: parsePositiveInt(
        process.env.DB_IDLE_IN_TXN_TIMEOUT_MS,
        60_000,
      ),
    };

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    max: poolMax,
    connect_timeout: parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_S, 30),
    connection: startupParameters,
    onnotice: () => {},
    prepare: false,
  },
  casing: config.casing,
  schema,
  relations,
  logger: false,
});
