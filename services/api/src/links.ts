import { queryChannelRegistry } from '@op/common/realtime';
import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import type { TRPCLink } from '@trpc/client';
import {
  httpBatchStreamLink,
  httpLink,
  loggerLink,
  splitLink,
} from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { readSSROnlySecret } from 'ssr-only-secrets';
import superjson from 'superjson';

import { isWrappedResponse, unwrapResponse } from './channelTransformer';
import type { AppRouter } from './routers';

/** @see https://trpc.io/docs/v11/getQueryKey */
type TRPCQueryKey = [
  readonly string[],
  { input?: unknown; type?: 'query' | 'infinite' }?,
];

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
        logger.error('Failed to decrypt SSR cookies', { error });
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
 * Custom link that registers queries and mutations with the channel registry.
 *
 * Extracts channels from wrapped response body (_meta.channels) and unwraps
 * data before passing to application.
 *
 * For queries: Registers channels for future invalidation lookup
 * For mutations: Triggers invalidation of queries registered on matching channels
 */
function createChannelRegistrationLink(): TRPCLink<AppRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        // Build query key manually - getQueryKey() requires typed procedures, not raw op data
        // @see https://trpc.io/docs/v11/getQueryKey
        const queryKey: TRPCQueryKey =
          op.type === 'query'
            ? [op.path.split('.'), { input: op.input, type: op.type }]
            : [op.path.split('.')];

        const unsubscribe = next(op).subscribe({
          next(value) {
            // Handle channel registration from response body (both queries and mutations)
            if (!isServer && value.result?.data !== undefined) {
              if (isWrappedResponse(value.result.data)) {
                const { data, channels } = unwrapResponse(value.result.data);
                if (channels.length > 0) {
                  if (op.type === 'query') {
                    console.log('Registering query channels', {
                      queryKey,
                      channels,
                      opId: op.id,
                      data,
                    });
                    // Register query's channels for future invalidation
                    queryChannelRegistry.registerQuery({ queryKey, channels });
                  } else if (op.type === 'mutation') {
                    // Get request ID from response headers, fallback to random UUID
                    const response = value.context?.response as
                      | Response
                      | undefined;
                    const requestId =
                      response?.headers.get('x-request-id') ??
                      crypto.randomUUID();

                    // Register mutation to trigger invalidation of matching queries
                    queryChannelRegistry.registerMutation({
                      channels,
                      mutationId: requestId,
                    });
                  }
                }

                // Unwrap data before passing to application
                value.result.data = data;
              }
            }

            observer.next(value);
          },
          error(err) {
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });

        return unsubscribe;
      });
    };
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
    // Channel registration link - processes response headers
    createChannelRegistrationLink(),
    // HTTP transport link
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
      false: httpBatchStreamLink({
        url: envURL.TRPC_URL,
        transformer: superjson,
        maxItems: 10,
        fetch: fetchFn,
      }),
    }),
  ];
}

// Backwards compatibility - creates links without SSR cookies
export const links = createLinks();
