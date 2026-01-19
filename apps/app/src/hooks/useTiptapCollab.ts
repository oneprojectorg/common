'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Hook to initialize TipTap Cloud collaboration provider.
 *
 * @param docId - Unique document identifier (format: proposal-{instanceId}-{proposalId})
 * @param enabled - Whether collaboration is enabled (false for local-only editing)
 * @returns Object containing the Y.Doc, provider, and connection status
 */
export function useTiptapCollab({
  docId,
  enabled = true,
}: {
  docId: string | null;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const providerRef = useRef<TiptapCollabProvider | null>(null);

  // Create Y.Doc once and memoize it
  const ydoc = useMemo(() => new Y.Doc(), []);

  useEffect(() => {
    if (!enabled || !docId) {
      setStatus('disconnected');
      return;
    }

    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;

    if (!appId) {
      console.error('NEXT_PUBLIC_TIPTAP_APP_ID is not set');
      setStatus('disconnected');
      return;
    }

    // Create the provider
    const provider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: 'notoken', // TODO: Replace with proper JWT auth
      document: ydoc,
      onConnect: () => {
        setStatus('connected');
      },
      onDisconnect: () => {
        setStatus('disconnected');
      },
      onSynced: () => {
        setIsSynced(true);
      },
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

/**
 * Generate a collaboration document ID for a proposal.
 *
 * @param instanceId - The process instance ID
 * @param proposalId - The proposal ID (optional for new proposals)
 * @returns The document ID in format: proposal-{instanceId}-{proposalId}
 */
export function generateCollabDocId(
  instanceId: string,
  proposalId?: string,
): string {
  const id = proposalId || crypto.randomUUID();
  return `proposal-${instanceId}-${id}`;
}
