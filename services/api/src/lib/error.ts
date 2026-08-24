import { CommonError, UnauthorizedError } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { TRPCErrorShape, TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import {
  type ErrorFormatter,
  getHTTPStatusCodeFromError,
  getStatusKeyFromCode,
} from '@trpc/server/unstable-core-do-not-import';
import { AccessControlException } from 'access-zones';
import { ZodError } from 'zod';

import type { TContext } from '../types';

/**
 * The `CommonError` a failed procedure is really reporting, or undefined when
 * it isn't reporting one.
 *
 * tRPC wraps anything a procedure throws in an `INTERNAL_SERVER_ERROR`
 * `TRPCError` and keeps the original under `cause`, so the outer error never
 * carries the status our service layer chose. `AccessControlException` comes
 * from access-zones rather than our own hierarchy, so it maps onto the
 * equivalent `UnauthorizedError`.
 */
const resolveCommonError = (error: TRPCError): CommonError | undefined => {
  const { cause } = error;

  if (cause instanceof AccessControlException) {
    return new UnauthorizedError(cause.message);
  }

  return cause instanceof CommonError ? cause : undefined;
};

/**
 * The HTTP status a failed procedure will actually answer with.
 *
 * `error.code` alone reports every rejection as a 500 — including the expected
 * 401/403/404 the access gates raise — because that's the code tRPC assigns
 * when it wraps the thrown error. Callers that need the real status before
 * `errorFormatter` runs (request logging, log severity) go through here.
 */
export const getErrorStatusCode = (error: TRPCError): number =>
  resolveCommonError(error)?.statusCode ?? getHTTPStatusCodeFromError(error);

class BackendError extends TRPCError {
  public readonly clientMessage;

  public readonly errorCode;

  constructor(opts: {
    message?: string;
    code: TRPC_ERROR_CODE_KEY;
    originalError?: unknown;
    cause?: unknown;
    clientMessage: string;
    errorCode: string;
  }) {
    super(opts);
    this.clientMessage = opts.clientMessage;
    this.errorCode = opts.errorCode;
  }
}

export const errorFormatter: ErrorFormatter<TContext, TRPCErrorShape> = ({
  shape,
  error,
}) => {
  const commonError = resolveCommonError(error);

  if (commonError) {
    const { statusCode } = commonError;

    return {
      ...shape,
      message: commonError.message,
      data: {
        ...shape.data,
        code: getStatusKeyFromCode(statusCode),
        httpStatus: statusCode,
        timestamp: commonError.timestamp,
        // Omit the entire error object before it goes to the client
      },
    };
  }

  const backendError = error as BackendError;

  return {
    ...shape,

    message:
      error.cause &&
      error.cause instanceof ZodError &&
      error.cause.issues.length
        ? `${error.cause.issues.reduce((prev, curr) => {
            if (prev === '') return `${curr.message} [${String(curr.path)}]`;

            return `${prev} | ${String(curr.path)} : ${curr.message}`;
          }, '')}`
        : shape.message,
    data: {
      ...shape.data,
      clientMessage: backendError.clientMessage
        ? backendError.clientMessage
        : undefined,
      errorCode: backendError.errorCode ? backendError.errorCode : undefined,
      zodError:
        error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
          ? error.cause
          : null,
    },
  };
};

export default BackendError;
