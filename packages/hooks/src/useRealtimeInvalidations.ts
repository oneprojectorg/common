import type { AppRouter } from '@op/api';
import { OPURLConfig } from '@op/core';
import { type InvalidationMessage, RealtimeManager } from '@op/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { useEffect, useState } from 'react';
import superjson from 'superjson';

// Create a vanilla tRPC client for imperative API calls in the browser
const envURL = OPURLConfig('API');
const vanillaClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: envURL.TRPC_URL,
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});

/**
 * Hook to listen for realtime cache invalidations
 *
 * Subscribes to one or more channels and automatically invalidates
 * React Query caches when invalidation messages are received.
 *
 * Uses a singleton Centrifuge instance shared across all hook instances
 * to ensure only one WebSocket connection is created.
 *
 * @param channels - Array of channel names to subscribe to (defaults to ['global'])
 *
 * @example
 * // Subscribe to global feed updates
 * useRealtimeInvalidations([Channels.global()]);
 *
 * @example
 * // Subscribe to org-specific updates
 * useRealtimeInvalidations([Channels.org(orgId)]);
 *
 * @example
 * // Subscribe to multiple channels
 * useRealtimeInvalidations([Channels.global(), Channels.org(orgId)]);
 */
export function useRealtimeInvalidations(channels: string[] = ['global']) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    // Initialize the manager with configuration (do this once at app startup)
    RealtimeManager.initialize({
      wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL!,
      getToken: async () => {
        console.log('[Centrifugo] Fetching token for WebSocket connection');
        const result = await vanillaClient.realtime.getToken.query();
        return result.token;
      },
    });

    const manager = RealtimeManager.getInstance();

    // Handler for invalidation messages
    const handleInvalidation = (data: InvalidationMessage) => {
      if (data.type === 'query-invalidation') {
        console.log('[Centrifugo] Invalidating:', {
          queryKey: data.queryKey,
        });
        queryClient.invalidateQueries({ queryKey: data.queryKey as any });
        setMessageCount((prev) => prev + 1);
      }
    };

    // Subscribe to all channels and collect unsubscribe functions
    const unsubscribeFunctions = channels.map((channel) =>
      manager.subscribe(channel, handleInvalidation),
    );

    // Listen for connection state changes
    manager.addConnectionListener(setIsConnected);

    // Cleanup
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
      manager.removeConnectionListener(setIsConnected);
    };
  }, [queryClient, ...channels]);

  return {
    isConnected,
    messageCount,
  };
}
