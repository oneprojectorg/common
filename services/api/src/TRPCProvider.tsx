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

// Should be update when TRP
import { QueryInvalidationSubscriber } from '../../../apps/app/src/utils/QueryInvalidationSubscriber';
import { createLinks } from './links';
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
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: createLinks(ssrCookies),
    }),
  );

  return (
    <SSRCookiesContext.Provider value={ssrCookies}>
      {/* eslint-disable-next-line react/no-context-provider */}
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
          <QueryInvalidationSubscriber />
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

// /**
//  * Component that sets up realtime subscriptions based on mutation channel headers.
//  * Must be rendered inside QueryClientProvider.
//  */
// function QueryInvalidationSubscriber() {
//   useInvalidateQueries();
//   return null;
// }
//
// /**
//  * Hook that subscribes to channel mutation events and invalidates queries.
//  *
//  * Listens to the queryChannelRegistry for mutation:added events, resolves
//  * the affected query keys, and invalidates them.
//  *
//  * Should be used once at the root level of your app.
//  *
//  * NOTE: This should be moved in apps/app
//  */
// export function useInvalidateQueries(): void {
//   const queryClient = useQueryClient();
//
//   useEffect(() => {
//     return queryChannelRegistry.on(
//       'mutation:added',
//       ({ channels }: { channels: ChannelName[] }) => {
//         const queryKeys =
//           queryChannelRegistry.getQueryKeysForChannels(channels);
//
//         for (const queryKey of queryKeys) {
//           queryClient.invalidateQueries({ queryKey });
//         }
//       },
//     );
//   }, [queryClient]);
// }
