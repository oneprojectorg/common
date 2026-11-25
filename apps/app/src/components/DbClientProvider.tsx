'use client';

import { trpc } from '@op/api/client';
import { DbClient, DbProvider } from '@tanstack/react-db';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

type TrpcClient = ReturnType<typeof trpc.useUtils>['client'];

/**
 * Gives TanStack DB collections the app's tRPC `QueryClient`, so a collection
 * and a tRPC hook on the same query key read one cache entry.
 */
export function DbClientProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { client: trpcClient } = trpc.useUtils();
  const [dbClient] = useState(() => new DbClient({ queryClient, trpcClient }));

  return <DbProvider client={dbClient}>{children}</DbProvider>;
}

export function getDbClientDependencies(dbClient: DbClient) {
  return {
    queryClient: dbClient.requireDependency<QueryClient>('queryClient'),
    trpcClient: dbClient.requireDependency<TrpcClient>('trpcClient'),
  };
}
