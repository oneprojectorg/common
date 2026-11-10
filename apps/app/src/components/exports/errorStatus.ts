/**
 * The HTTP status a failed tRPC call carries, or undefined when the error is
 * not one (a network failure, or anything thrown outside tRPC).
 *
 * The API's error formatter puts the status on `error.data.httpStatus`, typed
 * only as `object` on the client, so it is narrowed here once rather than at
 * each call site.
 */
export const getTrpcHttpStatus = (error: unknown): number | undefined => {
  if (
    !(error instanceof Error) ||
    !('data' in error) ||
    typeof error.data !== 'object' ||
    error.data === null ||
    !('httpStatus' in error.data) ||
    typeof error.data.httpStatus !== 'number'
  ) {
    return undefined;
  }

  return error.data.httpStatus;
};
