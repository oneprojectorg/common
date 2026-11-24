import { isTRPCClientError } from '@op/api/client';

/**
 * A tRPC 401: the request had no session (`AccessTierError('none')`). This is
 * an expected answer, not a defect, so callers show the signed-out state
 * instead of reporting it to Error Tracking.
 */
export const isUnauthenticatedError = (error: unknown) =>
  isTRPCClientError(error) &&
  !!error.data &&
  'httpStatus' in error.data &&
  error.data.httpStatus === 401;
