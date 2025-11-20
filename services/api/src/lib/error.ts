import { CommonError } from '@op/common';
import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import type { TRPCErrorShape, TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import {
  type ErrorFormatter,
  getStatusKeyFromCode,
} from '@trpc/server/unstable-core-do-not-import';
import { ZodError } from 'zod';

import type { TContext } from '../types';

// Example error you might get if your input validation fails
const error: TRPCError = {
  name: 'TRPCError',
  code: 'BAD_REQUEST',
  message: '"password" must be at least 4 characters',
};

if (error instanceof TRPCError) {
  const httpCode = getHTTPStatusCodeFromError(error);
  console.log(httpCode); // 400
}

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

  if (cause instanceof CommonError) {
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
