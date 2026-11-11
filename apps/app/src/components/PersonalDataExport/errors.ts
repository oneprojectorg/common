import { isTRPCClientError } from '@op/api/client';

// the client types `error.data` as `object`
export const getHttpStatus = (error: unknown) =>
  isTRPCClientError(error) &&
  error.data &&
  'httpStatus' in error.data &&
  typeof error.data.httpStatus === 'number'
    ? error.data.httpStatus
    : undefined;

/**
 * A 403 or 404: retrying gives the same answer. 401 is excluded because a
 * session refresh can race the read.
 */
export const isExportUnreachableError = (error: unknown) => {
  const status = getHttpStatus(error);
  return status === 403 || status === 404;
};
