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
 * Normalize an expected-error `cause` to the CommonError that carries its
 * real status/message. An access-zones denial maps to UnauthorizedError (403);
 * a CommonError passes through. Anything else (a genuine unexpected throw)
 * returns undefined. Single source of truth shared by the error formatter and
 * the request logger.
 */
const toExpectedCommonError = (cause: unknown): CommonError | undefined => {
  if (cause instanceof AccessControlException) {
    return new UnauthorizedError(cause.message);
  }

  if (cause instanceof CommonError) {
    return cause;
  }

  return undefined;
};

/**
 * Resolve a failed request's real HTTP status and tRPC code. tRPC wraps any
 * non-TRPCError thrown in the service layer as INTERNAL_SERVER_ERROR, so the
 * raw `error.code` reports 500 even for expected 4xx. Read the status off the
 * cause first, falling back to tRPC's own code→status mapping for native
 * TRPCErrors.
 */
export const classifyRequestError = (
  error: TRPCError,
): { httpStatus: number; code: TRPC_ERROR_CODE_KEY } => {
  const httpStatus =
    toExpectedCommonError(error.cause)?.statusCode ??
    getHTTPStatusCodeFromError(error);

  return { httpStatus, code: getStatusKeyFromCode(httpStatus) };
};

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
  const commonErrorToTRPCError = (cause: CommonError) => {
    return {
      ...shape,
      message: cause.message,
      data: {
        ...shape.data,
        code: getStatusKeyFromCode(cause.statusCode ?? 500),
        httpStatus: cause.statusCode ?? 500,
        timestamp: cause.timestamp,
        // Omit the entire error object before it goes to the client
      },
    };
  };

  const commonError = toExpectedCommonError(error.cause);
  if (commonError) {
    return commonErrorToTRPCError(commonError);
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
