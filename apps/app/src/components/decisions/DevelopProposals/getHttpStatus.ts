import { isTRPCClientError } from '@op/api/client';

/** The HTTP status of a failed develop call; the client types `error.data` as `object`. */
export function getHttpStatus(error: unknown): number | undefined {
  return isTRPCClientError(error) &&
    error.data &&
    'httpStatus' in error.data &&
    typeof error.data.httpStatus === 'number'
    ? error.data.httpStatus
    : undefined;
}

/** The server refuses a caller who confirmed their work with a 409. */
export function isDevelopLockedError(error: unknown) {
  return getHttpStatus(error) === 409;
}
