/**
 * Pure builder for the postgres-js pool options.
 *
 * Kept out of `index.ts` because that module calls `drizzle()` at import time —
 * anything colocated there can only be exercised by opening a real connection.
 * Here the timeouts that keep a dropped Supavisor socket off the request path
 * are ordinary values a test can assert on.
 */

/** The subset of `process.env` the pool reads. */
export type PoolEnv = Record<string, string | undefined>;

export interface PoolOptions {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  connection: {
    statement_timeout?: number;
    idle_in_transaction_session_timeout?: number;
  };
}

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
): number => {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Migrations and seeds run against a cold database and skip the request-path caps. */
export const isMaintenanceEnv = (env: PoolEnv): boolean =>
  Boolean(env.DB_MIGRATING || env.DB_SEEDING);

export const buildPoolOptions = (env: PoolEnv): PoolOptions => {
  const isMaintenance = isMaintenanceEnv(env);

  // IMPORTANT: postgres-js treats an explicit `max: undefined` as
  // Array(undefined) → length 1, i.e. a single-socket pool. Parallel queries
  // then pipeline onto that one socket, which hangs forever against
  // Supavisor transaction-mode pooling. Always resolve to a concrete number.
  // E2E deliberately gets a real pool too — pinning it to 1 socket starved
  // parallel Playwright workers and flaked tests (#1399).
  const max = isMaintenance ? 1 : parsePositiveInt(env.DB_POOL_MAX, 10);

  // Connection-startup parameters sent to Postgres. Skipped under
  // DB_MIGRATING/DB_SEEDING so long DDL (CREATE INDEX, ALTER TABLE) and seed
  // inserts are not killed by a short request-side timeout.
  const connection = isMaintenance
    ? {}
    : {
        statement_timeout: parsePositiveInt(
          env.DB_STATEMENT_TIMEOUT_MS,
          30_000,
        ),
        idle_in_transaction_session_timeout: parsePositiveInt(
          env.DB_IDLE_IN_TXN_TIMEOUT_MS,
          60_000,
        ),
      };

  // postgres-js defaults `idle_timeout` to null — pooled sockets are held open
  // forever. Against the Supavisor transaction pooler that loses the race: the
  // pooler reaps its own idle client connections, and a serverless instance that
  // freezes between requests comes back with dead TCP peers either way. The next
  // request then writes to a socket nobody is listening on and the query fails
  // with `write CONNECTION_CLOSED`. Closing our own idle sockets first keeps that
  // off the request path.
  const idle_timeout = parsePositiveInt(env.DB_IDLE_TIMEOUT_S, 20);

  // A stalled connect should surface inside a page render's budget rather than
  // hold the request open for half a minute. Maintenance keeps the longer window
  // because migrations and seeds run against a cold, often just-started database.
  const connect_timeout = parsePositiveInt(
    env.DB_CONNECT_TIMEOUT_S,
    isMaintenance ? 30 : 10,
  );

  return { max, idle_timeout, connect_timeout, connection };
};
