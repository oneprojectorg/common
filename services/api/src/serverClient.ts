import { OPURLConfig } from '@op/core';
import {
  createTRPCProxyClient,
  loggerLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import { customAlphabet } from 'nanoid';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import superjson from 'superjson';

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
          return fetch(url, {
            ...options,
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
const createServerContext = cache(async (): Promise<TContext> => {
  const headersList = await headers();
  const cookieStore = await cookies();
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  const requestId = [
    nanoid().slice(0, 4),
    nanoid().slice(4, 12),
    nanoid().slice(12, 20),
    nanoid().slice(20, 24),
  ].join('-');

  const allHeaders = Object.fromEntries(headersList);
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  if (cookieHeader) {
    allHeaders['cookie'] = cookieHeader;
  }

  // Create a mock Request object with headers and cookies
  const mockReq = new Request(envURL.TRPC_URL, {
    headers: allHeaders,
  });

  return {
    getCookies: () => {
      const cookies: Record<string, string | undefined> = {};
      cookieStore.getAll().forEach((cookie) => {
        cookies[cookie.name] = cookie.value;
      });
      return cookies;
    },
    getCookie: (name: string) => {
      return cookieStore.get(name)?.value;
    },
    setCookie: () => {
      throw new Error(
        'Cannot set cookies in server-side caller context. Use a route handler with fetchRequestHandler instead.',
      );
    },
    // Server-side calls don't need channel propagation via headers
    setChannels: () => {},
    getChannels: () => [],
    requestId,
    time: Date.now(),
    ip: headersList.get('x-forwarded-for') || null,
    reqUrl: headersList.get('x-url') || mockReq.url,
    req: mockReq,
    isServerSideCall: true,
  };
});

/**
 * Create a server-side tRPC client
 *
 * This uses createCallerFactory to call procedures directly without HTTP overhead.
 * Recommended for use in Server Components and Server Actions.
 *
 * Note: Cannot set cookies. For mutations that need to set cookies, use a route handler.
 */
export const createClient = cache(async () => {
  const context = await createServerContext();
  const callerFactory = createCallerFactory(appRouter);
  return callerFactory(context);
});

/**
 * @deprecated Use `createClient()` from '@op/api/serverClient' instead for better performance
 */
export const trpcVanilla = createTRPCVanillaClient();

/**
 * Get tRPC client for Next.js server components (HTTP-based)
 *
 * @deprecated Use `createClient()` from '@op/api/serverClient' for better performance.
 * This makes HTTP requests which is inefficient when called from the same server.
 *
 * Note: Kept for backward compatibility with existing code using .query()/.mutate() syntax.
 */
export const trpcNext = async () => {
  const headersList = await headers();
  const cookieStore = await cookies();

  const allHeaders = Object.fromEntries(headersList);
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  if (cookieHeader) {
    allHeaders['cookie'] = cookieHeader;
  }

  return createTRPCVanillaClient(allHeaders);
};
