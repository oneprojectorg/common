/**
 * The HTTP semantics of a server error, carried to the browser on the error's
 * `digest`.
 *
 * In production React replaces the message of an error thrown during a Server
 * Components render with a generic one; only `digest` survives, and Next.js
 * forwards a digest the error already has. The server-side tRPC caller sets
 * one from the failing procedure's `CommonError`, and the app's error boundary
 * reads it back to show a 403 or 404 instead of a 500.
 */
export type ErrorDigest = {
  /** The status the API would have sent for this error. */
  statusCode: number;
  /** The error class, e.g. `UnauthorizedError`. */
  name: string;
};

const PREFIX = 'COMMON_ERROR';

export const encodeErrorDigest = ({ statusCode, name }: ErrorDigest): string =>
  `${PREFIX};${statusCode};${name}`;

/**
 * Decodes a digest written by `encodeErrorDigest`. Returns null for a digest
 * Next.js generated itself, or none at all.
 */
export const parseErrorDigest = (
  digest: string | undefined,
): ErrorDigest | null => {
  if (!digest) {
    return null;
  }

  const [prefix, status, name] = digest.split(';');
  if (prefix !== PREFIX || !status || !name) {
    return null;
  }

  const statusCode = Number(status);
  return Number.isInteger(statusCode) ? { statusCode, name } : null;
};
