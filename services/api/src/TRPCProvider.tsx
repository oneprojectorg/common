'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { TRPCClientError } from '@trpc/client';
import {
  createTRPCReact,
  getQueryKey as getQueryKeyTRPC,
} from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import React, { useState } from 'react';

import { createLinks } from './links';
import { queryPersister } from './queryPersister';
import type { AppRouter } from './routers';

export { clearPersistedQueryCache } from './queryPersister';

// A module-level QueryClient is shared across every SSR render on the same
// Node worker — two concurrent requests would read each other's cached
// account data (24h gcTime). Instantiate per-provider via useState below.

export const trpc = createTRPCReact<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

export const getQueryKey = getQueryKeyTRPC;

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError;
}

/**
 * TRPCProvider. During a server render the links forward the request's
 * cookies; in the browser, cookies are sent via credentials: 'include'.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: createLinks(),
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          // Bump whenever a persisted payload's shape changes. Entries are
          // kept for 24h, so without this a returning user restores posts
          // shaped for the previous release and renders undefined counts.
          // Last bumped: every list/paginated payload moved to the
          // { items } / { items, next } envelope (#2001–#2003).
          buster: 'list-items-envelope-1',
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const queryIsReadyForPersistance =
                query.state.status === 'success';

              if (queryIsReadyForPersistance) {
                const { queryKey } = query;
                const excludeFromPersisting =
                  queryKey.includes('ogImageThumbnail');

                return !excludeFromPersisting;
              }

              return queryIsReadyForPersistance;
            },
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </trpc.Provider>
  );
}

export const skipBatch = {
  trpc: {
    context: {
      skipBatch: true,
    },
  },
};
