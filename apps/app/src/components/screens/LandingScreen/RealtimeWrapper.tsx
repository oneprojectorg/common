'use client';

import { useRealtimeInvalidations } from '@op/hooks';
import { ReactNode } from 'react';

interface RealtimeWrapperProps {
  children: ReactNode;
}

/**
 * Client component wrapper that subscribes to realtime invalidations
 * on the global channel for the landing screen
 */
export function RealtimeWrapper({ children }: RealtimeWrapperProps) {
  // Subscribe to global channel for realtime cache invalidations
  const { isConnected, messageCount } = useRealtimeInvalidations(['global']);

  // Optional: Log connection status for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[LandingScreen] Realtime connection:', {
      isConnected,
      messageCount,
    });
  }

  return <>{children}</>;
}
