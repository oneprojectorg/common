import { OPURLConfig } from '@op/core';
import {
  httpLink,
  loggerLink,
  splitLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import posthog from 'posthog-js';
import superjson from 'superjson';

import { extractMutationChannels } from './mutationChannelsStore';

// Function to get PostHog distinct_id if available
function getPostHogDistinctId(): string | null {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    try {
      const distinctId = posthog.get_distinct_id();
      return distinctId;
    } catch (error) {
      console.error('Error getting distinct_id:', error);
    }
  }

  return null;
}

/**
 * Custom fetch wrapper that extracts mutation channels from response headers.
 */
async function fetchWithMutationChannels(
  url: URL | RequestInfo,
  options?: RequestInit,
): Promise<Response> {
  const distinctId = getPostHogDistinctId();
  const headers = new Headers(options?.headers);

  if (distinctId) {
    headers.set('x-posthog-distinct-id', distinctId);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Extract mutation channels from response header
  extractMutationChannels(response);

  return response;
}

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
      fetch: fetchWithMutationChannels,
    }),
    false: unstable_httpBatchStreamLink({
      /**
       * If you want to use SSR, you need to use the server's full URL
       * @link https://trpc.io/docs/ssr
       */
      url: envURL.TRPC_URL,
      transformer: superjson,
      maxItems: 4,
      fetch: fetchWithMutationChannels,
    }),
  }),
];
