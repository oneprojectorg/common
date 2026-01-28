'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabUser {
  name: string;
  color: string;
}

/**
 * Collaboration cursor colors - visually distinct palette
 * Colors are assigned based on awareness state order to ensure
 * each user gets a unique color within a session
 */
const COLLAB_COLORS = [
  '#f783ac', // pink
  '#4dabf7', // blue
  '#69db7c', // green
  '#ffa94d', // orange
  '#da77f2', // purple
  '#ffd43b', // yellow
  '#38d9a9', // teal
  '#ff6b6b', // red
  '#a9e34b', // lime
  '#74c0fc', // light blue
];

export interface UseTiptapCollabOptions {
  docId: string | null;
  enabled?: boolean;
  /** User's display name for the collaboration cursor */
  userName?: string;
}

export interface UseTiptapCollabReturn {
  ydoc: Y.Doc;
  provider: TiptapCollabProvider | null;
  status: CollabStatus;
  isSynced: boolean;
  isConnected: boolean;
  /** User object with assigned color for this session */
  user: CollabUser;
}

/** Initialize TipTap Cloud collaboration provider */
export function useTiptapCollab({
  docId,
  enabled = true,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);
  const [colorIndex, setColorIndex] = useState(0);

  const ydoc = useMemo(() => new Y.Doc(), []);

  // Compute user object with assigned color
  const user = useMemo<CollabUser>(
    () => ({
      name: userName,
      color: COLLAB_COLORS[colorIndex % COLLAB_COLORS.length] ?? '#f783ac',
    }),
    [userName, colorIndex],
  );

  // Assign color based on awareness state order
  const assignColorFromAwareness = useCallback(
    (currentProvider: TiptapCollabProvider) => {
      const awareness = currentProvider.awareness;
      if (!awareness) {
        return;
      }

      const localClientId = awareness.clientID;
      const states = Array.from(awareness.getStates().keys()).sort(
        (a, b) => a - b,
      );
      const index = states.indexOf(localClientId);

      if (index !== -1) {
        setColorIndex(index);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !docId) {
      setStatus('disconnected');
      return;
    }

    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    if (!appId) {
      console.error('[useTiptapCollab] NEXT_PUBLIC_TIPTAP_APP_ID not set');
      setStatus('disconnected');
      return;
    }

    const newProvider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: 'notoken', // TODO: proper JWT auth
      document: ydoc,
      onConnect: () => {
        setStatus('connected');
      },
      onDisconnect: () => {
        setStatus('disconnected');
        setIsSynced(false);
      },
      onSynced: () => {
        setIsSynced(true);
      },
    });

    // Listen for awareness changes to reassign colors when users join/leave
    const awareness = newProvider.awareness;
    if (awareness) {
      const handleAwarenessChange = () => {
        assignColorFromAwareness(newProvider);
      };

      awareness.on('change', handleAwarenessChange);
      // Initial assignment
      assignColorFromAwareness(newProvider);
    }

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
    };
  }, [docId, enabled, ydoc, assignColorFromAwareness]);

  // Update awareness when user info changes
  useEffect(() => {
    if (provider && status === 'connected') {
      provider.setAwarenessField('user', user);
    }
  }, [provider, user, status]);

  return {
    ydoc,
    provider,
    status,
    isSynced,
    isConnected: status === 'connected',
    user,
  };
}
