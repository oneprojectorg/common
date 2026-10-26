/**
 * HTTP status of a server error, carried on `error.digest` because React strips
 * the message of a server render error in production.
 */
export type ErrorDigest = {
  statusCode: number;
  name: string;
};

const PREFIX = 'COMMON_ERROR';

export const encodeErrorDigest = ({ statusCode, name }: ErrorDigest): string =>
  `${PREFIX};${statusCode};${name}`;

/** Returns null for a digest not written by `encodeErrorDigest`. */
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
