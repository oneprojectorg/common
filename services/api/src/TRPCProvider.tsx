'use client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createTRPCClient, TRPCClientError } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import React from 'react';

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

// Create vanilla tRPC client for the new TanStack React Query integration
export const trpc = createTRPCClient<AppRouter>({
  links,
});

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export const skipBatch = {
  trpc: {
    context: {
      skipBatch: true,
    },
  },
};
