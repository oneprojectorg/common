/**
 * Socket-level failures that mean a pooled connection died between requests
 * rather than a query being rejected by Postgres: a Supavisor/pgbouncer socket
 * reaped while it sat idle in our pool, or a serverless instance whose TCP peer
 * went away across a freeze/thaw. The statement never reached the server, so
 * replaying a read is safe.
 *
 * `CONNECTION_CLOSED` is postgres-js's own code (`Errors.connection`, surfaced
 * as `write CONNECTION_CLOSED <host>:<port>`); `ECONNRESET` and `EPIPE` are the
 * Node socket errors behind the same dead-peer condition.
 */
const TRANSIENT_CONNECTION_CODES: ReadonlySet<string> = new Set([
  'CONNECTION_CLOSED',
  'ECONNRESET',
  'EPIPE',
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
