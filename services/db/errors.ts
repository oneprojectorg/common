/**
 * Socket-level failures that mean a pooled connection died between requests
 * rather than a query being rejected by Postgres: a Supavisor/pgbouncer socket
 * reaped while it sat idle in our pool, or a serverless instance whose TCP peer
 * went away across a freeze/thaw. The statement never reached the server, so
 * replaying a read is safe.
 *
 * Three sources, one condition:
 *
 * - postgres-js's own codes for a socket it found already gone
 *   (`write CONNECTION_CLOSED <host>:<port>`, and the ended/destroyed variants
 *   it raises when the pool tears a connection down mid-flight).
 * - Node's socket errors for a dead peer.
 * - The Postgres SQLSTATEs a server or pooler sends as it drops the session.
 *   `57P01` is what Supavisor and Postgres deliver to in-flight sessions on a
 *   restart — the single most common way this outage actually arrives.
 *
 * Deliberately excluded: `CONNECT_TIMEOUT`. That one has already spent the full
 * `connect_timeout` budget, so replaying it doubles the user's wait instead of
 * saving the request.
 */
const TRANSIENT_CONNECTION_CODES: ReadonlySet<string> = new Set([
  // postgres-js (`Errors.connection`)
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  // Node socket
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  // Postgres SQLSTATE
  '57P01', // admin_shutdown — terminating connection due to administrator command
  '08006', // connection_failure
  '08003', // connection_does_not_exist
]);

/** Depth cap so a self-referential `cause` chain cannot spin forever. */
const MAX_CAUSE_DEPTH = 10;

const getErrorCode = (error: Error): string | undefined =>
  'code' in error && typeof error.code === 'string' ? error.code : undefined;

/**
 * True when `error` — or anything in its `cause` chain — is a dropped database
 * socket rather than a real query failure.
 *
 * The chain walk is what makes this usable above the service layer: tRPC wraps
 * anything a resolver throws in a `TRPCError` whose `cause` holds the driver
 * error, so the code is never on the outermost error.
 */
export const isTransientConnectionError = (error: unknown): boolean => {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) {
      return false;
    }

    const code = getErrorCode(current);
    if (code !== undefined && TRANSIENT_CONNECTION_CODES.has(code)) {
      return true;
    }

    current = current.cause;
  }

  return false;
};
