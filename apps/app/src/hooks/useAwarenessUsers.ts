'use client';

import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useState } from 'react';

import type { CollabUser } from './useTiptapCollab';

export interface AwarenessUser extends CollabUser {
  clientId: number;
}

/**
 * Subscribe to awareness changes and return list of connected users.
 * Filters out the local user (your own clientId).
 */
export function useAwarenessUsers(
  provider: TiptapCollabProvider | null,
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
        // Skip local user
        if (clientId === localClientId) {
          return;
        }

        // Only include users with valid user data
        const user = state.user;
        if (isValidUser(user)) {
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
  }, [provider]);

  return users;
}

function isValidUser(user: unknown): user is CollabUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'name' in user &&
    typeof user.name === 'string'
  );
}
