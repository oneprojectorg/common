import { QueryChannelStore } from '@op/common/src/channels/query-channel-store';
import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import type { ChannelName } from '@op/realtime';
import { type TRPCLink, httpLink, loggerLink, splitLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { readSSROnlySecret } from 'ssr-only-secrets';
import superjson from 'superjson';

import {
  MUTATION_CHANNELS_HEADER,
  SUBSCRIPTION_CHANNELS_HEADER,
} from './constants';
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

/** Global reference to queryClient - set via initializeQueryInvalidation */
let queryClientRef: {
  invalidateQueries: (opts: { queryKey: unknown[] }) => void;
} | null = null;

/** Global query channel store instance */
export const queryChannelStore = new QueryChannelStore();

/**
 * Initialize query invalidation with a reference to the queryClient.
 * Must be called once at app startup (in useMutationChannels or similar).
 */
export function initializeQueryInvalidation(queryClient: {
  invalidateQueries: (opts: { queryKey: unknown[] }) => void;
}): void {
  queryClientRef = queryClient;
}

/**
 * Create a fetch function that handles SSR cookies.
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

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    return response;
  };
}

/**
 * Custom link that handles channel-based query invalidation.
 *
 * For queries: Registers the query key with subscription channels from x-subscription-channels header
 * For mutations: Looks up query keys for channels from x-mutation-channels header and invalidates them
 */
function createChannelInvalidationLink(): TRPCLink<AppRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        // Build the query key from the operation path and input
        // tRPC query keys are [path, { input, type }] for queries
        // and [path] for mutations
        const queryKey =
          op.type === 'query'
            ? [op.path.split('.'), { input: op.input, type: op.type }]
            : [op.path.split('.')];

        const unsubscribe = next(op).subscribe({
          next(value) {
            // Process response headers for channel handling
            // The value.context contains the response from httpLink
            if (!isServer && value.context?.response) {
              const response = value.context.response as Response;

              if (op.type === 'query') {
                // Register query's subscription channels
                const subscriptionChannelsHeader = response.headers.get(
                  SUBSCRIPTION_CHANNELS_HEADER,
                );
                if (subscriptionChannelsHeader) {
                  const channels = subscriptionChannelsHeader
                    .split(',')
                    .filter(Boolean) as ChannelName[];
                  queryChannelStore.addQueryKeyForChannels(queryKey, channels);
                }
              } else if (op.type === 'mutation') {
                // Look up and invalidate queries for mutation channels
                const mutationChannelsHeader = response.headers.get(
                  MUTATION_CHANNELS_HEADER,
                );
                if (mutationChannelsHeader && queryClientRef) {
                  const channels = mutationChannelsHeader
                    .split(',')
                    .filter(Boolean) as ChannelName[];
                  const queryKeysToInvalidate =
                    queryChannelStore.getQueryKeysForChannels(channels);

                  for (const key of queryKeysToInvalidate) {
                    queryClientRef.invalidateQueries({ queryKey: key });
                  }
                }
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
    // Channel invalidation link - processes response headers
    createChannelInvalidationLink(),
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
      false: httpLink({
        url: envURL.TRPC_URL,
        transformer: superjson,
        fetch: fetchFn,
      }),
    }),
  ];
}

// Backwards compatibility - creates links without SSR cookies
export const links = createLinks();
