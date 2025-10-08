import { OPURLConfig } from '@op/core';
import {
  createTRPCProxyClient,
  loggerLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import { cookies, headers } from 'next/headers';
import superjson from 'superjson';

import type { AppRouter } from './routers';

const envURL = OPURLConfig('API');

/**
 * Create a TRPC Vanilla Client.
 *
 * Passing headers is necessary for authentication and session management.
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

export const trpcVanilla = createTRPCVanillaClient();
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
