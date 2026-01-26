'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseTiptapCollabOptions {
  docId: string | null;
  enabled?: boolean;
}

export interface UseTiptapCollabReturn {
  ydoc: Y.Doc;
  provider: TiptapCollabProvider | null;
  status: CollabStatus;
  isSynced: boolean;
  isConnected: boolean;
}

/** Initialize TipTap Cloud collaboration provider */
export function useTiptapCollab({
  docId,
  enabled = true,
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

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

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
    };
  }, [docId, enabled, ydoc]);

  return {
    ydoc,
    provider,
    status,
    isSynced,
    isConnected: status === 'connected',
  };
}
