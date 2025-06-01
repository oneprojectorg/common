// import type { User } from '@op/supabase/lib';
import { logger as opLogger } from '@op/logger';
import spacetime from 'spacetime';

import type { MiddlewareBuilderBase, TContextWithLogger } from '../types';

const withLogger: MiddlewareBuilderBase<TContextWithLogger> = async ({
  ctx,
  path,
  type,
  next,
}) => {
  const start = Date.now();
  const logger = {
    info: (message: string, data?: Record<string, any>) => {
      opLogger.info(message, {
        requestId: ctx.requestId,
        path,
        type,
        ip: ctx.ip,
        ...data,
      });
    },
    error: (message: string, error?: Error, data?: Record<string, any>) => {
      opLogger.error(message, {
        requestId: ctx.requestId,
        path,
        type,
        ip: ctx.ip,
        error,
        ...data,
      });
    },
    warn: (message: string, data?: Record<string, any>) => {
      opLogger.warn(message, {
        requestId: ctx.requestId,
        path,
        type,
        ip: ctx.ip,
        ...data,
      });
    },
  };

  const result = await next({
    ctx: {
      ...ctx,
      logger,
    },
  });
  const end = Date.now();

  const duration = end - start;
  const logHeadline = `[${spacetime(ctx.time).format('nice')}] - ${duration}ms`;

  // Log result
  if (result.ok) {
    console.log(`✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);
  } else if (result.error) {
    opLogger.error('Request failed', {
      requestId: ctx.requestId,
      path,
      type,
      ip: ctx.ip,
      duration,
      status: 'error',
      timestamp: end,
      errorCode: result.error.code,
      errorName: result.error.name,
      error: result.error,
    });
  } else {
    console.log(
      `? UNHANDLED ERROR:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`,
    );
    opLogger.error('Unhandled error', {
      requestId: ctx.requestId,
      path,
      type,
      ip: ctx.ip,
      duration,
      status: 'unhandled_error',
      error: result.error,
      timestamp: end,
    });
  }

  return result;
};

export default withLogger;
