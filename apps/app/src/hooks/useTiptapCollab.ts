'use client';

import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseTiptapCollabOptions {
  /** Unique document identifier for TipTap Cloud */
  docId: string | null;
  /** Whether collaboration is enabled (default: true) */
  enabled?: boolean;
}

export interface UseTiptapCollabReturn {
  /** Y.js document instance for collaborative editing */
  ydoc: Y.Doc;
  /** TipTap Cloud provider instance (null before connection) */
  provider: TiptapCollabProvider | null;
  /** Current connection status */
  status: CollabStatus;
  /** Whether the document is synced with the server */
  isSynced: boolean;
  /** Convenience boolean for connected status */
  isConnected: boolean;
}

/**
 * Hook to initialize TipTap Cloud collaboration provider.
 *
 * Creates a Y.js document and connects to TipTap Cloud for real-time sync.
 * The Y.Doc is passed to the Collaboration extension in your editor config.
 *
 * @example
 * ```tsx
 * const { ydoc, status, isSynced } = useTiptapCollab({
 *   docId: 'proposal-123-456',
 *   enabled: true,
 * });
 *
 * // Pass ydoc to Collaboration extension
 * const extensions = [
 *   StarterKit.configure({ history: false }),
 *   Collaboration.configure({ document: ydoc }),
 * ];
 * ```
 */
export function useTiptapCollab({
  docId,
  enabled = true,
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const providerRef = useRef<TiptapCollabProvider | null>(null);

  // Create Y.Doc once - stable across re-renders
  const ydoc = useMemo(() => new Y.Doc(), []);

  useEffect(() => {
    // Early return if disabled or no docId
    if (!enabled || !docId) {
      setStatus('disconnected');
      return;
    }

    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;

    if (!appId) {
      console.error(
        '[useTiptapCollab] NEXT_PUBLIC_TIPTAP_APP_ID is not set. ' +
          'Collaboration will not work. See .env.local.example for setup.',
      );
      setStatus('disconnected');
      return;
    }

    // Create the provider and connect
    const provider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: 'notoken', // TODO: Replace with proper JWT auth from backend
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

    providerRef.current = provider;

    // Cleanup on unmount or when deps change
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
 * Format: `proposal-{instanceId}-{proposalId}`
 *
 * @param instanceId - The process instance ID
 * @param proposalId - The proposal ID (generates UUID if not provided)
 */
export function generateCollabDocId(
  instanceId: string,
  proposalId?: string,
): string {
  const id = proposalId || crypto.randomUUID();
  return `proposal-${instanceId}-${id}`;
}
