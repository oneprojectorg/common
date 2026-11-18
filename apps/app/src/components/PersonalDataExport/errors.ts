import { getHttpStatus } from '@/utils/getHttpStatus';

/**
 * A 403 or 404: retrying gives the same answer. 401 is excluded because a
 * session refresh can race the read.
 */
export const isExportUnreachableError = (error: unknown) => {
  const status = getHttpStatus(error);
  return status === 403 || status === 404;
};
