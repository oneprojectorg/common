// import type { User } from '@op/supabase/lib';
import {
  logger as opLogger,
  setLogSessionId,
  withLogContext,
} from '@op/logging';
import spacetime from 'spacetime';

import type { MiddlewareBuilderBase, TContextWithLogger } from '../types';

// withLogContext opens the request-scoped log context that the auth
// middlewares later stamp with the caller's PostHog distinct id — wrapping
// the whole body keeps even the post-`next()` failure logs person-linked.
const withLogger: MiddlewareBuilderBase<TContextWithLogger> = async ({
  ctx,
  path,
  type,
  next,
}) =>
  withLogContext(async () => {
    // The frontend forwards its PostHog session id; stamping it here links
    // every log emitted during the request to the user's session replay.
    const sessionId = ctx.req.headers.get('x-posthog-session-id');
    if (sessionId) {
      setLogSessionId(sessionId);
    }

    const start = Date.now();
    const logger = {
      debug: (message: string, data?: Record<string, unknown>) => {
        opLogger.debug(message, {
          requestId: ctx.requestId,
          path,
          type,
          ip: ctx.ip,
          ...data,
        });
      },
      info: (message: string, data?: Record<string, unknown>) => {
        opLogger.info(message, {
          requestId: ctx.requestId,
          path,
          type,
          ip: ctx.ip,
          ...data,
        });
      },
      warn: (message: string, data?: Record<string, unknown>) => {
        opLogger.warn(message, {
          requestId: ctx.requestId,
          path,
          type,
          ip: ctx.ip,
          ...data,
        });
      },
      error: (message: string, data?: Record<string, unknown>) => {
        opLogger.error(message, {
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

    // Log result (skip success logs in test environment)
    if (result.ok) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`,
        );
      }
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
  });

export default withLogger;
