import { TRPCClientError } from '@trpc/client';

import type { AppRouter } from './routers';

// Re-exported so consumers can recognise/build tRPC client errors without
// taking a direct dependency on `@trpc/client`.
export { TRPCClientError };

/**
 * Message text browsers use when a fetch never reached the server (Chrome,
 * Safari, and Firefox wording). These carry no HTTP status — the request got no
 * response — so a transient network failure can only be recognised by type +
 * message.
 */
const NETWORK_ERROR_MESSAGES = new Set([
  'Failed to fetch', // Chrome / Edge
  'Load failed', // Safari
  'NetworkError when attempting to fetch resource.', // Firefox
]);

export function isTRPCClientError(
  error: unknown,
): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}

/**
 * Reads the HTTP status off a tRPC error's `data` without trusting its shape:
 * `data` is a deserialized network payload (and is null for transport
 * failures), so we narrow with `in`/`typeof` rather than casting.
 */
function getHttpStatus(error: TRPCClientError<AppRouter>): number | undefined {
  const data: unknown = error.data;
  if (data === null || data === undefined || typeof data !== 'object') {
    return undefined;
  }

  return 'httpStatus' in data && typeof data.httpStatus === 'number'
    ? data.httpStatus
    : undefined;
}

/**
 * A transient network failure — the fetch never reached the server, so there's
 * no HTTP status to key on. Used to decide whether to retry; a genuine failure
 * that outlives its retries still surfaces (and is captured) as a real error.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return NETWORK_ERROR_MESSAGES.has(error.message);
  }
  if (isTRPCClientError(error)) {
    return (
      getHttpStatus(error) === undefined &&
      NETWORK_ERROR_MESSAGES.has(error.message)
    );
  }
  return false;
}
