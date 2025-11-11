import { Session } from '@supabase/supabase-js';
import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  getCookie as _getCookie,
  getCookies as _getCookies,
  setCookie as _setCookie,
} from './lib/cookies';
import { errorFormatter } from './lib/error';
import withLogger from './middlewares/withLogger';
import type { TContext } from './types';

/**
 * Defines your inner context shape.
 * Add fields here that the inner context brings.
 *
 * Inner context will always be available in your procedures, in contrast to the outer context.
 *
 * Also useful for:
 * - testing, so you don't have to mock the request/response objects
 * - tRPC's `createServerSideHelpers` where we don't have `req`/`res`
 *
 * @see https://trpc.io/docs/v11/context#inner-and-outer-context
 */
export interface CreateInnerContextOptions
  extends Partial<FetchCreateContextFnOptions> {
  requestId?: string;
  time?: number;
  ip?: string | null;
  reqUrl?: string;
  isServerSideCall?: boolean;
  session: Session | null;
}

/**
 * Inner context. Will always be available in your procedures, in contrast to the outer context.
 *
 * @see https://trpc.io/docs/v11/context#inner-and-outer-context
 */
export async function createContextInner(opts?: CreateInnerContextOptions) {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  // Generate requestId if not provided (for testing/server-side calls)
  const requestId =
    opts?.requestId ||
    [
      nanoid().slice(0, 4),
      nanoid().slice(4, 12),
      nanoid().slice(12, 20),
      nanoid().slice(20, 24),
    ].join('-');

  return {
    requestId,
    time: opts?.time ?? Date.now(),
    ip: opts?.ip ?? null,
    reqUrl: opts?.reqUrl,
    isServerSideCall: opts?.isServerSideCall,
    session: opts?.session ?? null,
  };
}

/**
 * Outer context. Used in the routers and will bring `req` & `resHeaders` to the context.
 *
 * @see https://trpc.io/docs/v11/context#inner-and-outer-context
 */
export const createContext = async ({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<TContext> => {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  // seperate in 4-8-8-4 xxxx-xxxxxxxx-xxxxxxxx-xxxx
  const requestId = [
    nanoid().slice(0, 4),
    nanoid().slice(4, 12),
    nanoid().slice(12, 20),
    nanoid().slice(20, 24),
  ].join('-');

  resHeaders.set('x-request-id', requestId);

  const getCookies: TContext['getCookies'] = () => {
    return _getCookies(req);
  };

  const getCookie: TContext['getCookie'] = (name) => {
    return _getCookie(req, name);
  };

  const setCookie: TContext['setCookie'] = ({ name, value, options }) => {
    return _setCookie({ resHeaders, name, value, options });
  };

  const contextInner = await createContextInner({
    requestId,
    time: Date.now(),
    ip: req.headers.get('X-Forwarded-For') || null,
    reqUrl: req.url,
    session: null, // You can integrate your auth system here to get the session/u
  });

  return {
    ...contextInner,
    getCookies,
    getCookie,
    setCookie,
    req,
  };
};

export type Context = Awaited<ReturnType<typeof createContextInner>>;

const t = initTRPC
  .meta<OpenApiMeta>()
  .context<TContext>()
  .create({
    errorFormatter,
    transformer: superjson,
    experimental: {
      iterablesAndDeferreds: true,
    },
  });

export const { router } = t;
export const { middleware } = t;
export const { mergeRouters } = t;
export const createCallerFactory = t.createCallerFactory;
export const loggedProcedure = t.procedure.use(withLogger);
