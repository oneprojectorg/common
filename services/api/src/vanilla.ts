import { OPURLConfig } from '@op/core';
import {
  createTRPCProxyClient,
  loggerLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
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
        async fetch(url, options) {
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
