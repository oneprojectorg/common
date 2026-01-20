'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const providerRef = useRef<TiptapCollabProvider | null>(null);

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

    const provider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: 'notoken', // TODO: proper JWT auth
      document: ydoc,
      onConnect: () => setStatus('connected'),
      onDisconnect: () => {
        setStatus('disconnected');
        setIsSynced(false);
      },
      onSynced: () => setIsSynced(true),
    });

    providerRef.current = provider;
    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [docId, enabled, ydoc]);

  return {
    ydoc,
    provider: providerRef.current,
    status,
    isSynced,
    isConnected: status === 'connected',
  };
}

/** Generate collab doc ID: `proposal-{instanceId}-{proposalId}` */
export function generateCollabDocId(
  instanceId: string,
  proposalId?: string,
): string {
  const id = proposalId || crypto.randomUUID();
  return `proposal-${instanceId}-${id}`;
}
