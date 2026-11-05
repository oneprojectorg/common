import { queryChannelRegistry } from '@op/common/realtime';
import {
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  OPURLConfig,
  isOnPreviewAppDomain,
} from '@op/core';
import { logger } from '@op/logging';
import type { TRPCLink } from '@trpc/client';
import {
  httpBatchStreamLink,
  httpLink,
  loggerLink,
  splitLink,
} from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { PostHog } from 'posthog-js';
import { readSSROnlySecret } from 'ssr-only-secrets';
import superjson from 'superjson';

import { unwrapResponseWithChannels } from './channelTransformer';
import type { AppRouter } from './routers';

/** @see https://trpc.io/docs/v11/getQueryKey */
type TRPCQueryKey = [
  readonly string[],
  { input?: unknown; type?: 'query' | 'infinite' }?,
];

/**
 * Build the key used to invalidate a query for a channel. `invalidateQueries`
 * partial-matches, so this must mirror the shape tRPC caches under: drop `type`
 * (matches both `query` and `infinite`) and strip `cursor`/`direction` (tRPC
 * strips them from infinite keys). Remaining input stays for scoping.
 *
 * FIXME(interim): hand-mirroring tRPC's internal key shape is brittle and
 * breaks silently if that shape drifts. The clean fix is to tag queries with
 * their channels (e.g. React Query `meta`) and invalidate by predicate instead.
 */
function buildChannelQueryKey(path: string, input: unknown): TRPCQueryKey {
  const splitPath = path.split('.');
  if (input === null || typeof input !== 'object') {
    return [splitPath];
  }

  const inputWithoutPagination: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key !== 'cursor' && key !== 'direction') {
      inputWithoutPagination[key] = value;
    }
  }

  return [splitPath, { input: inputWithoutPagination }];
}

const SSR_SECRETS_KEY_VAR = 'SSR_SECRETS_KEY';
const isServer = typeof window === 'undefined';

// Read a value off the loaded posthog-js client, guarding against SSR and the
// client not being initialized yet.
function readPostHog<T>(read: (posthog: PostHog) => T): T | null {
  if (isServer) {
    return null;
  }

  try {
    // Dynamic import to avoid server-side issues with posthog-js
    const posthog: PostHog = require('posthog-js').default;
    if (posthog?.__loaded) {
      return read(posthog);
    }
  } catch {
    // PostHog not available
  }

  return null;
}

// Function to get PostHog distinct_id if available
function getPostHogDistinctId(): string | null {
  return readPostHog((posthog) => posthog.get_distinct_id());
}

// Function to get the current PostHog session_id if available. Forwarding it to
// the backend links server-side logs to the user's session replay.
function getPostHogSessionId(): string | null {
  return readPostHog((posthog) => posthog.get_session_id());
}

const envURL = OPURLConfig('API');

// On preview deployments, use relative URL (proxied through Next.js rewrites)
// to avoid cross-origin cookie issues between app and api preview subdomains
const trpcUrl =
  envURL.IS_PREVIEW && isOnPreviewAppDomain ? '/api/v1/trpc' : envURL.TRPC_URL;

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

    // Required by the API's CSRF gate (forces a preflight on every
    // mutating call, blocking cross-origin form-style CSRF posts).
    headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);

    // Add PostHog distinct_id if available
    const distinctId = getPostHogDistinctId();
    if (distinctId) {
      headers.set('x-posthog-distinct-id', distinctId);
    }

    // Add PostHog session_id so the backend can link its logs to the replay
    const sessionId = getPostHogSessionId();
    if (sessionId) {
      headers.set('x-posthog-session-id', sessionId);
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
 * tRPC stores infinite queries under a different cache key than plain queries:
 * `type: 'infinite'` with the `cursor`/`direction` pagination fields stripped
 * (see getQueryKeyInternal). The link only ever sees `op.type === 'query'`, so
 * the `type: 'query'` key it builds never matches an infinite list's cache
 * entry. Registering this variant too lets channel invalidations reach
 * paginated feeds (proposals, posts, …). Returns null when the input can't be
 * an infinite key.
 */
function buildInfiniteQueryKey(
  path: string,
  input: unknown,
): TRPCQueryKey | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const {
    cursor: _cursor,
    direction: _direction,
    ...rest
  } = input as Record<string, unknown>;
  return [path.split('.'), { input: rest, type: 'infinite' }];
}

/**
 * Custom link that registers queries and mutations with the channel registry.
 *
 * Extracts channels from wrapped response body (_meta.channels) and unwraps
 * data before passing to application. Unwrapping happens on both server (SSR)
 * and client; channel registration only happens on the client because the
 * registry is a module singleton that would leak across requests on the server.
 *
 * For queries: Registers channels for future invalidation lookup
 * For mutations: Triggers invalidation of queries registered on matching channels
 */
export function createChannelRegistrationLink(): TRPCLink<AppRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        // Build query key manually - getQueryKey() requires typed procedures, not raw op data
        // @see https://trpc.io/docs/v11/getQueryKey
        const queryKey = buildChannelQueryKey(op.path, op.input);

        const unsubscribe = next(op).subscribe({
          next(value) {
            if (value.result?.data !== undefined) {
              const unwrapped = unwrapResponseWithChannels(value.result.data);
              if (unwrapped) {
                const { data, channels } = unwrapped;
                const isServerRuntime = typeof window === 'undefined';
                if (!isServerRuntime && channels.length > 0) {
                  if (op.type === 'query') {
                    // Register query's channels for future invalidation
                    queryChannelRegistry.registerQuery({ queryKey, channels });
                    // Infinite queries live under a `type: 'infinite'` cache key,
                    // so also register that variant — otherwise paginated lists
                    // never get invalidated by their channels.
                    const infiniteQueryKey = buildInfiniteQueryKey(
                      op.path,
                      op.input,
                    );
                    if (infiniteQueryKey) {
                      queryChannelRegistry.registerQuery({
                        queryKey: infiniteQueryKey,
                        channels,
                      });
                    }
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
                observer.next({
                  ...value,
                  result: {
                    ...value.result,
                    data,
                  },
                });

                return;
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
        url: trpcUrl,
        transformer: superjson,
        fetch: fetchFn,
      }),
      false: httpBatchStreamLink({
        url: trpcUrl,
        transformer: superjson,
        maxItems: 4,
        fetch: fetchFn,
      }),
    }),
  ];
}
