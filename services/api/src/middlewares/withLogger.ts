// import type { User } from '@op/supabase/lib';
import {
  initLogs,
  getLogger,
  patchConsole,
  logger as opLogger,
} from '@op/logging';
import spacetime from 'spacetime';

import type { MiddlewareBuilderBase, TContextWithLogger } from '../types';

// Initialize PostHog logging at module load
const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (apiKey) {
  initLogs({
    apiKey,
    region: 'eu',
    serviceName: 'api',
    serviceVersion: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    immediateFlush: true, // Send logs immediately for debugging
  });

  // Patch console methods to also send to PostHog
  patchConsole('api:console');
} else {
  console.warn('PostHog logging disabled: NEXT_PUBLIC_POSTHOG_KEY not set');
}

const apiLogger = getLogger('api');

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

  if (result.ok) {
    console.log(`✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);

    apiLogger.info(
      {
        'request.id': ctx.requestId,
        'request.path': path,
        'request.type': type,
        'request.duration_ms': duration,
        'request.status': 'ok',
        'client.ip': ctx.ip || 'unknown',
      },
      'API request completed',
    );
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

    apiLogger.error(
      {
        'request.id': ctx.requestId,
        'request.path': path,
        'request.type': type,
        'request.duration_ms': duration,
        'request.status': 'error',
        'error.code': result.error.code,
        'error.name': result.error.name,
        'error.message': result.error.message,
        'error.stack': result.error instanceof Error ? result.error.stack : undefined,
        'client.ip': ctx.ip || 'unknown',
      },
      'API request failed',
    );
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

    apiLogger.error(
      {
        'request.id': ctx.requestId,
        'request.path': path,
        'request.type': type,
        'request.duration_ms': duration,
        'request.status': 'unhandled_error',
        'client.ip': ctx.ip || 'unknown',
      },
      'API unhandled error',
    );
  }

  return result;
};

export default withLogger;
