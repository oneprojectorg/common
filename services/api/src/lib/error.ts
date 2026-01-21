import { CommonError, UnauthorizedError } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { TRPCErrorShape, TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import {
  type ErrorFormatter,
  getStatusKeyFromCode,
} from '@trpc/server/unstable-core-do-not-import';
import { AccessControlException } from 'access-zones';
import { ZodError } from 'zod';

import type { TContext } from '../types';

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
  const cause = error.cause;
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

  if (cause instanceof AccessControlException) {
    return commonErrorToTRPCError(new UnauthorizedError(cause.message));
  }

  if (cause instanceof CommonError) {
    return commonErrorToTRPCError(cause);
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
