'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
}

/** Initialize TipTap Cloud collaboration provider */
export function useTiptapCollab({
  docId,
  enabled = true,
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  /**
   * Handle stateless messages from TipTap Cloud.
   * - 'saved' action: document was persisted
   * - 'version.created' action: a new snapshot version was created
   */
  const handleStatelessMessage = useCallback((payload: { payload: string }) => {
    try {
      const data = JSON.parse(payload.payload);
      const action = data.action ?? data.event;
      if (action === 'saved' || action === 'version.created') {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      }
    } catch {
      // Ignore parse errors for non-JSON messages
    }
  }, []);

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
      onConnect: () => {
        setStatus('connected');
        // Check if there's an existing last saved timestamp
        const saved = provider.getLastSaved();
        if (saved) {
          setLastSavedAt(saved);
          setSaveStatus('saved');
        }
      },
      onDisconnect: () => {
        setStatus('disconnected');
        setIsSynced(false);
      },
      onSynced: () => {
        setIsSynced(true);
        // Update last saved from provider after sync
        const saved = provider.getLastSaved();
        if (saved) {
          setLastSavedAt(saved);
          setSaveStatus('saved');
        }
      },
      onStateless: handleStatelessMessage,
      onClose: () => {
        setSaveStatus('error');
      },
      onAuthenticationFailed: () => {
        setSaveStatus('error');
      },
    });

    setProvider(provider);
    return () => {
      provider.destroy();
      setProvider(null);
    };
  }, [docId, enabled, ydoc, handleStatelessMessage]);

  // Track document changes to show "saving" status
  useEffect(() => {
    const handleUpdate = () => {
      if (status === 'connected') {
        setSaveStatus('saving');
      }
    };

    ydoc.on('update', handleUpdate);
    return () => {
      ydoc.off('update', handleUpdate);
    };
  }, [ydoc, status]);

  return {
    ydoc,
    provider,
    status,
    isSynced,
    isConnected: status === 'connected',
    saveStatus,
    lastSavedAt,
  };
}
