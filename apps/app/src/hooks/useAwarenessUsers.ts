'use client';

import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useState } from 'react';

import type { CollabUser } from './useTiptapCollab';

export interface AwarenessUser extends CollabUser {
  clientId: number;
}

/**
 * Subscribe to awareness changes and return list of connected users.
 * Filters out the local user (your own clientId) by default.
 */
export function useAwarenessUsers(
  provider: TiptapCollabProvider | null,
  { includeLocal = false }: { includeLocal?: boolean } = {},
): AwarenessUser[] {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    if (!provider?.awareness) {
      setUsers([]);
      return;
    }

    const awareness = provider.awareness;
    const localClientId = awareness.clientID;

    const updateUsers = () => {
      const states = awareness.getStates();
      const connectedUsers: AwarenessUser[] = [];

      states.forEach((state, clientId) => {
        // Skip local user unless explicitly included
        if (!includeLocal && clientId === localClientId) {
          return;
        }

        // Only include users with valid user data
        const user = state.user as
          | { name?: string; color?: string }
          | undefined;
        if (user?.name) {
          connectedUsers.push({
            clientId,
            name: user.name,
            color: user.color ?? '#888888',
          });
        }
      });

      setUsers(connectedUsers);
    };

    // Initial population
    updateUsers();

    // Subscribe to changes
    provider.on('awarenessChange', updateUsers);

    return () => {
      provider.off('awarenessChange', updateUsers);
    };
  }, [provider, includeLocal]);

  return users;
}
