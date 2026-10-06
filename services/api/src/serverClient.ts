import { CSRF_HEADER, CSRF_HEADER_VALUE, OPURLConfig } from '@op/core';
import '@tanstack/react-start/server-only';
import {
  getCookie,
  getCookies,
  getRequestHeaders,
} from '@tanstack/react-start/server';
import {
  createTRPCProxyClient,
  loggerLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';

import { cachePerRequest } from './cachePerRequest';
import { type AppRouter, appRouter } from './routers';
import { createCallerFactory } from './trpcFactory';
import type { TContext } from './types';

const envURL = OPURLConfig('API');

/**
 * Create a TRPC Vanilla Client.
 *
 * @deprecated Use `createClient()` from '@op/api/serverClient' for server-side calls instead.
 * This makes actual HTTP requests which is inefficient when called from the same server.
 * Only use this if you specifically need HTTP-based communication.
 */
export const createTRPCVanillaClient = (headers?: Record<string, string>) => {
  return createTRPCProxyClient<AppRouter>({
    links: [
      ...(!envURL.IS_PRODUCTION
        ? [
            loggerLink({
              colorMode: 'none',
            }),
          ]
        : []),
      unstable_httpBatchStreamLink({
        url: envURL.TRPC_URL,
        transformer: superjson,
        headers,
        fetch(url, options) {
          const merged = new Headers(options?.headers);
          // Required by the API's CSRF gate — see packages/core/src/csrf.ts.
          merged.set(CSRF_HEADER, CSRF_HEADER_VALUE);
          return fetch(url, {
            ...options,
            headers: merged,
            credentials: 'include',
          });
        },
      }),
    ],
  });
};

/**
 * Create tRPC context for server-side calls
 *
 * This is used with createCallerFactory for direct procedure calls
 * without HTTP overhead. Note: Cannot set cookies in this context.
 */
export const createServerContext = cachePerRequest(
  async (): Promise<TContext> => {
    const headersList = getRequestHeaders();
    const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

    const requestId = [
      nanoid().slice(0, 4),
      nanoid().slice(4, 12),
      nanoid().slice(12, 20),
      nanoid().slice(20, 24),
    ].join('-');

    // Create a mock Request object with headers and cookies
    const mockReq = new Request(envURL.TRPC_URL, {
      headers: Object.fromEntries(headersList),
    });

    return {
      getCookies: () => getCookies(),
      getCookie: (name: string) => getCookie(name),
      setCookie: () => {
        throw new Error(
          'Cannot set cookies in server-side caller context. Use a route handler with fetchRequestHandler instead.',
        );
      },
      // Server-side calls don't need channel propagation
      registerMutationChannels: () => {},
      registerQueryChannels: () => {},
      requestId,
      time: Date.now(),
      ip: headersList.get('x-forwarded-for') || null,
      reqUrl: mockReq.url,
      req: mockReq,
      isServerSideCall: true,
    };
  },
);

/**
 * Create a server-side tRPC client
 *
 * This uses createCallerFactory to call procedures directly without HTTP overhead.
 * Recommended for use in server functions and server routes.
 *
 * Note: Cannot set cookies. For mutations that need to set cookies, use a route handler.
 */
export const createClient = cachePerRequest(async () => {
  const context = await createServerContext();
  const callerFactory = createCallerFactory(appRouter);
  return callerFactory(context);
});

/**
 * @deprecated Use `createClient()` from '@op/api/serverClient' instead for better performance
 */
export const trpcVanilla = createTRPCVanillaClient();
