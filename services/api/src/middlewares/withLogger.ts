// import type { User } from '@op/supabase/lib';
import {
  type OTelLogger,
  getLogger,
  initLogs,
  logger as opLogger,
} from '@op/logging';
import spacetime from 'spacetime';

import type { MiddlewareBuilderBase, TContextWithLogger } from '../types';

// Track logging initialization state
let logsInitialized: 'pending' | 'success' | 'disabled' = 'pending';

function getOTelLogger(): OTelLogger | null {
  if (logsInitialized === 'disabled') {
    return null;
  }

  if (logsInitialized === 'pending') {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      console.warn('PostHog logging disabled: NEXT_PUBLIC_POSTHOG_KEY not set');
      logsInitialized = 'disabled';
      return null;
    }

    initLogs({
      apiKey,
      region: 'eu',
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      immediateFlush: true, // Send logs immediately for debugging
    });

    logsInitialized = 'success';
  }

  return getLogger('api');
}

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
  const phLogger = getOTelLogger();

  if (result.ok) {
    console.log(`✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);

    // Log successful request to PostHog
    phLogger?.info('API request completed', {
      'request.id': ctx.requestId,
      'request.path': path,
      'request.type': type,
      'request.duration_ms': duration,
      'request.status': 'ok',
      'client.ip': ctx.ip || 'unknown',
    });
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

    // Log error to PostHog
    phLogger?.error(
      'API request failed',
      result.error instanceof Error ? result.error : undefined,
      {
        'request.id': ctx.requestId,
        'request.path': path,
        'request.type': type,
        'request.duration_ms': duration,
        'request.status': 'error',
        'error.code': result.error.code,
        'error.name': result.error.name,
        'client.ip': ctx.ip || 'unknown',
      },
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

    // Log unhandled error to PostHog
    phLogger?.error('API unhandled error', undefined, {
      'request.id': ctx.requestId,
      'request.path': path,
      'request.type': type,
      'request.duration_ms': duration,
      'request.status': 'unhandled_error',
      'client.ip': ctx.ip || 'unknown',
    });
  }

  return result;
};

export default withLogger;
