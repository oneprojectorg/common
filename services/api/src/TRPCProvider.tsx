'use client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
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
import type { AppRouter } from './routers';

// A module-level QueryClient is shared across every SSR render on the same
// Node worker — two concurrent requests would read each other's cached
// account data (24h gcTime). Instantiate per-provider via useState below.

/**
 * Context for SSR-only cookies (encrypted, only available during SSR)
 * This allows tRPC HTTP calls to include cookies during SSR
 */
const SSRCookiesContext = createContext<string | undefined>(undefined);

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

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
            persister,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => {
                const queryIsReadyForPersistence =
                  query.state.status === 'success';

                if (queryIsReadyForPersistence) {
                  const { queryKey } = query;
                  const excludeFromPersisting =
                    queryKey.includes('ogImageThumbnail');

                  return !excludeFromPersisting;
                }

                return queryIsReadyForPersistence;
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
