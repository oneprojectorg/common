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
import React, { useState } from 'react';

import { links } from './links';
import type { AppRouter } from './routers';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
    },
  },
});

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

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links,
    }),
  );

  return (
    // eslint-disable-next-line react/no-context-provider
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
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
