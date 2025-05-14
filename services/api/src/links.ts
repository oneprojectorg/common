import { OPURLConfig } from '@op/core';
import { loggerLink, unstable_httpBatchStreamLink } from '@trpc/client';
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
  unstable_httpBatchStreamLink({
    /**
     * If you want to use SSR, you need to use the server's full URL
     * @link https://trpc.io/docs/ssr
     */
    url: envURL.TRPC_URL,
    transformer: superjson,

    async fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: 'include',
      });
    },
  }),
];
