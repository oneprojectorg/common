'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { TRPCClientError } from '@trpc/client';
import {
  createTRPCReact,
  getQueryKey as getQueryKeyTRPC,
} from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import React, { createContext, useState } from 'react';

import { createLinks } from './links';
import { queryPersister } from './queryPersister';
import type { AppRouter } from './routers';

// A module-level QueryClient is shared across every SSR render on the same
// Node worker — two concurrent requests would read each other's cached
// account data (24h gcTime). Instantiate per-provider via useState below.

/**
 * Context for SSR-only cookies (encrypted, only available during SSR)
 * This allows tRPC HTTP calls to include cookies during SSR
 */
const SSRCookiesContext = createContext<string | undefined>(undefined);

export { clearPersistedQueryCache } from './queryPersister';

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
 * TRPCProvider with SSR cookie support
 *
 * ssrCookies: Encrypted cookies from Server Component (using cloakSSROnlySecret).
 * These are decrypted during SSR to include in tRPC HTTP requests.
 * On the browser, cookies are sent via credentials: 'include'.
 */
export function TRPCProvider({
  children,
  ssrCookies,
}: {
  children: React.ReactNode;
  ssrCookies?: string;
}) {
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
      links: createLinks(ssrCookies),
    }),
  );

  return (
    <SSRCookiesContext.Provider value={ssrCookies}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            // Bump whenever a persisted payload's shape changes. Entries are
            // kept for 24h, so without this a returning user restores posts
            // shaped for the previous release and renders undefined counts.
            // Previously: every list/paginated payload moved to the
            // { items } / { items, next } envelope (#2001–#2003).
            // Last bumped: React Query 5.66 -> 5.102. The dehydrated query
            // gained `dehydratedAt` (5.76.2) and `queryType` (5.100.2); an
            // entry written by 5.66 carries neither, so a restored infinite
            // query is untagged until an observer re-applies it.
            buster: 'tanstack-query-5-102-1',
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
    </SSRCookiesContext.Provider>
  );
}

export const skipBatch = {
  trpc: {
    context: {
      skipBatch: true,
    },
  },
};
