import { OPURLConfig } from '@op/core';
import {
  httpLink,
  loggerLink,
  splitLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import superjson from 'superjson';

const envURL = OPURLConfig('API');

export const links = [
  ...(!envURL.IS_PRODUCTION
    ? [
      loggerLink({
        colorMode: 'none',
      }),
    ]
    : []),
  splitLink({
    condition(op) {
      // Check if skipBatch is set in the context
      return op.context.skipBatch === true;
    },
    // Use regular httpLink (no batching) when skipBatch is true
    true: httpLink({
      url: envURL.TRPC_URL,
      transformer: superjson,
      async fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
    false: unstable_httpBatchStreamLink({
      /**
       * If you want to use SSR, you need to use the server's full URL
       * @link https://trpc.io/docs/ssr
       */
      url: envURL.TRPC_URL,
      transformer: superjson,
      maxItems: 4,

      async fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  }),
];
