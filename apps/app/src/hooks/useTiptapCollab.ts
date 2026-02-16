'use client';

import { getAvatarColorForString } from '@op/ui/utils';
import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabUser {
  name: string;
  color: string;
}

export interface UseTiptapCollabOptions {
  docId: string | null;
  enabled?: boolean;
  /** JWT token for Tiptap Cloud authentication */
  token: string | null;
  /** Called when Tiptap Cloud rejects the JWT (expired or invalid) */
  onAuthenticationFailed?: () => void;
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
  token,
  onAuthenticationFailed,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  // Derive color from username - matches Avatar gradient
  const user = useMemo<CollabUser>(() => {
    const { hex } = getAvatarColorForString(userName);
    return { name: userName, color: hex };
  }, [userName]);

  useEffect(() => {
    if (!enabled || !docId || !token) {
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
      token,
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
      onAuthenticationFailed: () => {
        setStatus('disconnected');
        onAuthenticationFailed?.();
      },
    });

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
    };
  }, [docId, enabled, onAuthenticationFailed, token, ydoc]);

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
