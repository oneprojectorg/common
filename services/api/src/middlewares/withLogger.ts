// import type { User } from '@op/supabase/lib';
import { CommonError } from '@op/common';
import { POSTHOG_SESSION_ID_COOKIE } from '@op/core';
import {
  getPosthogCookieName,
  logger as opLogger,
  parsePosthogDistinctId,
  setLogDistinctId,
  setLogSessionId,
  withLogContext,
} from '@op/logging';
import type { TRPCError } from '@trpc/server';
import { AccessControlException } from 'access-zones';

import { anonymizeIp } from '../lib/anonymizeIp';
import type { MiddlewareBuilderBase, TContextWithLogger } from '../types';

// The caller's IP is personal data, and a log line per request is not a
// proportionate place to keep it (GDPR Art. 5(1)(c)). It stays on the events it
// is actually needed for — a rejected or throttled caller — and even there only
// as an anonymized network prefix. Unauthenticated (401), unauthorized (403)
// and throttled (429) are those events.
const SECURITY_RELEVANT_STATUS_CODES = new Set([401, 403, 429]);

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
    // Browser HTTP calls carry it as a header; server-side renders never do,
    // so fall back to the cookie the frontend mirrors it into.
    const sessionId =
      ctx.req.headers.get('x-posthog-session-id') ??
      ctx.getCookie(POSTHOG_SESSION_ID_COOKIE);
    if (sessionId) {
      setLogSessionId(sessionId);
    }

    const start = Date.now();

    // Seed the log context with the browser's PostHog distinct id up front, so
    // requests that never resolve an authenticated user — logged-out callers on
    // open endpoints, and requests rejected before an auth middleware runs
    // `setLogDistinctId` — still link to a person. `setLogDistinctId(user.id)`
    // later overrides this once auth resolves (for a logged-in user the cookie
    // already holds that same id).
    const cookieName = getPosthogCookieName();
    if (cookieName) {
      const cookieDistinctId = parsePosthogDistinctId(
        ctx.getCookie(cookieName),
      );
      if (cookieDistinctId) {
        setLogDistinctId(cookieDistinctId);
      }
    }

    const logger = {
      debug: (message: string, data?: Record<string, unknown>) => {
        opLogger.debug(message, {
          requestId: ctx.requestId,
          path,
          type,
          ...data,
        });
      },
      info: (message: string, data?: Record<string, unknown>) => {
        opLogger.info(message, {
          requestId: ctx.requestId,
          path,
          type,
          ...data,
        });
      },
      warn: (message: string, data?: Record<string, unknown>) => {
        opLogger.warn(message, {
          requestId: ctx.requestId,
          path,
          type,
          ...data,
        });
      },
      error: (message: string, data?: Record<string, unknown>) => {
        opLogger.error(message, {
          requestId: ctx.requestId,
          path,
          type,
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

    // Emit a wide record on success too (not just failures) so requests that
    // carry the caller's PostHog session id produce a log linked to their
    // session replay — an error-only log stream never surfaces the happy path.
    if (result.ok) {
      opLogger.info(`${path} OK`, {
        requestId: ctx.requestId,
        path,
        type,
        duration,
        status: 'ok',
        timestamp: end,
      });
    } else if (result.error) {
      // Log the actual error message as the body so the log stream is
      // self-explanatory — a wall of identical "Request failed" lines forces a
      // drill-in on every entry. Code/name/stack stay in the attributes.
      opLogger.error(result.error.message || 'Request failed', {
        requestId: ctx.requestId,
        path,
        type,
        ...(isSecurityRelevant(result.error) && { ip: anonymizeIp(ctx.ip) }),
        duration,
        status: 'error',
        timestamp: end,
        errorCode: result.error.code,
        errorName: result.error.name,
        error: result.error,
      });
    } else {
      // A failure tRPC gave us no error for — treat it as security-relevant,
      // since we can't tell what rejected the request.
      opLogger.error('Unhandled error', {
        requestId: ctx.requestId,
        path,
        type,
        ip: anonymizeIp(ctx.ip),
        duration,
        status: 'unhandled_error',
        error: result.error,
        timestamp: end,
      });
    }

    return result;
  });

/**
 * Was the request rejected for a reason worth recording the caller's network
 * for — a failed authorization or a tripped rate limit?
 *
 * Every rejection here is raised below the tRPC layer as a `CommonError` (or
 * the access-zones exception) and reaches us wrapped in an
 * `INTERNAL_SERVER_ERROR`, so the cause carries the signal, not `error.code`.
 */
const isSecurityRelevant = (error: TRPCError): boolean =>
  error.cause instanceof AccessControlException ||
  (error.cause instanceof CommonError &&
    SECURITY_RELEVANT_STATUS_CODES.has(error.cause.statusCode));

export default withLogger;
