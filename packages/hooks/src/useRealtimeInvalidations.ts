import { CentrifugeManager, type InvalidationMessage } from '@op/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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
    const manager = CentrifugeManager.getInstance();

    // Handler for invalidation messages
    const handleInvalidation = (data: InvalidationMessage) => {
      if (data.type === 'cache-invalidation') {
        console.log('[Centrifugo] Invalidating:', {
          queryKey: data.queryKey,
        });
        queryClient.invalidateQueries({ queryKey: data.queryKey as any });
        setMessageCount((prev) => prev + 1);
      }
    };

    // Subscribe to all channels
    channels.forEach((channel) => {
      manager.subscribe(channel, handleInvalidation);
    });

    // Listen for connection state changes
    manager.addConnectionListener(setIsConnected);

    // Cleanup
    return () => {
      channels.forEach((channel) => {
        manager.unsubscribe(channel, handleInvalidation);
      });
      manager.removeConnectionListener(setIsConnected);
    };
  }, [queryClient, ...channels]);

  return {
    isConnected,
    messageCount,
  };
}
