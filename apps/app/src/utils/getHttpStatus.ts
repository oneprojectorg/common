import { isTRPCClientError } from '@op/api/client';

// The client types `error.data` as `object`.
export function getHttpStatus(error: unknown): number | undefined {
  return isTRPCClientError(error) &&
    error.data &&
    'httpStatus' in error.data &&
    typeof error.data.httpStatus === 'number'
    ? error.data.httpStatus
    : undefined;
}
