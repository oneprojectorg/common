import { OPURLConfig } from '@op/core';
import { log } from '@op/logging';
import {
  httpLink,
  loggerLink,
  splitLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import type { TRPCLink } from '@trpc/client';
import { readSSROnlySecret } from 'ssr-only-secrets';
import superjson from 'superjson';

import type { AppRouter } from './routers';

const SSR_SECRETS_KEY_VAR = 'SSR_SECRETS_KEY';
const isServer = typeof window === 'undefined';

// Function to get PostHog distinct_id if available
function getPostHogDistinctId(): string | null {
  if (isServer) {
    return null;
  }

  try {
    // Dynamic import to avoid server-side issues with posthog-js
    // eslint-disable-next-line ts/no-require-imports
    const posthog = require('posthog-js').default;
    if (posthog?.__loaded) {
      return posthog.get_distinct_id();
    }
  } catch {
    // PostHog not available
  }

  return null;
}

const envURL = OPURLConfig('API');

/**
 * Create a fetch function that handles SSR cookies
 *
 * During SSR: Decrypts the encrypted cookies and adds them to the request headers
 * In browser: Uses credentials: 'include' to send cookies normally
 */
function createFetchWithSSRCookies(encryptedCookies?: string) {
  return async (
    url: URL | RequestInfo,
    options?: RequestInit,
  ): Promise<Response> => {
    const headers = new Headers(options?.headers);

    // Add PostHog distinct_id if available
    const distinctId = getPostHogDistinctId();
    if (distinctId) {
      headers.set('x-posthog-distinct-id', distinctId);
    }

    // On server: decrypt SSR cookies and add to headers
    // On browser: use credentials: 'include' (cookies sent automatically)
    if (isServer && encryptedCookies) {
      try {
        const cookies = await readSSROnlySecret(
          encryptedCookies,
          SSR_SECRETS_KEY_VAR,
        );
        if (cookies) {
          headers.set('cookie', cookies);
        }
      } catch (error) {
        log.error('Failed to decrypt SSR cookies', { error });
      }
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };
}

/**
 * Create tRPC links with optional SSR cookie support
 *
 * @param encryptedCookies - Encrypted cookie string from Server Component
 *                           (created with cloakSSROnlySecret)
 */
export function createLinks(encryptedCookies?: string): TRPCLink<AppRouter>[] {
  const fetchFn = createFetchWithSSRCookies(encryptedCookies);

  return [
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
        fetch: fetchFn,
      }),
      false: unstable_httpBatchStreamLink({
        /**
         * If you want to use SSR, you need to use the server's full URL
         * @link https://trpc.io/docs/ssr
         */
        url: envURL.TRPC_URL,
        transformer: superjson,
        maxItems: 4,
        fetch: fetchFn,
      }),
    }),
  ];
}

// Backwards compatibility - creates links without SSR cookies
export const links = createLinks();
