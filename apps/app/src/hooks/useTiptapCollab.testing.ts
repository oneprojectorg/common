'use client';

import { getAvatarColorForString } from '@op/styles/constants';
import {
  TiptapCollabProvider,
  TiptapCollabProviderWebsocket,
} from '@tiptap-pro/provider';
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabUser {
  name: string;
  color: string;
}

export interface UseTiptapCollabOptions {
  docId: string;
  /** Called on every connect; must be referentially stable. */
  getToken: () => Promise<string>;
  /** User's display name for the collaboration cursor */
  userName?: string;
}

export interface UseTiptapCollabReturn {
  ydoc: Y.Doc;
  provider: TiptapCollabProvider | null;
  status: CollabStatus;
  isSynced: boolean;
  isConnected: boolean;
  hasSyncedOnce: boolean;
  /** User object with assigned color for this session */
  user: CollabUser;
}

/** How long a local edit takes to "settle" before this double clears `hasUnsyncedChanges`. */
const FAKE_ACK_DELAY_MS = 300;

/**
 * Test double for `useTiptapCollab`, swapped in only for E2E builds — see
 * the `E2E === 'true'` alias in `apps/app/next.config.mjs`.
 *
 * CI has no reachable TipTap Cloud collab server: `NEXT_PUBLIC_TIPTAP_APP_ID`
 * is a placeholder (`'e2e'` in `tests/e2e/playwright.config.ts`), so the real
 * provider's websocket fails DNS resolution
 * (`wss://e2e.collab.tiptap.cloud`). That was harmless until the submit gate
 * (`ensureDocSynced`) started requiring the provider to actually reach
 * `synced`, with no unsynced changes, before allowing a submit — see PR
 * #2091.
 *
 * Rather than reimplement `TiptapCollabProvider`'s surface (versions,
 * threads, awareness — all exercised by the Snapshot and CollaborationCaret
 * TipTap extensions on every collaborative field), this constructs the real
 * class and gives it a `websocketProvider` that never dials out
 * (`autoConnect: false`, and nothing ever calls `.connect()` on it). That
 * leaves every synchronous method genuinely implemented by the real
 * `@tiptap-pro/provider` code, and turns every method that would touch the
 * network (`send`, and everything built on it — `sendStateless`,
 * `createVersion`, `revertToVersion`, ...) into a no-op:
 * `HocuspocusProvider.send` gates on an internal "attached" flag that only a
 * real `.attach()` call sets, and nothing here ever makes one.
 *
 * What's left to fake is exactly the two states a real server ack would
 * report and this one never will: the initial `synced` handshake, and
 * `hasUnsyncedChanges` clearing after each local edit. Both are driven below
 * to mirror what the real provider's own `decrementUnsyncedChanges` does for
 * a real ack.
 */
export function useTiptapCollab({
  docId,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  // Derive color from username - matches Avatar gradient
  const user = useMemo<CollabUser>(() => {
    const { hex } = getAvatarColorForString(userName);
    return { name: userName, color: hex };
  }, [userName]);

  useEffect(() => {
    // Never dialed — `autoConnect: false` below, and nothing calls
    // `.connect()` on it. The URL only has to be syntactically valid.
    const websocketProvider = new TiptapCollabProviderWebsocket({
      baseUrl: 'ws://127.0.0.1:1',
      autoConnect: false,
    });

    const newProvider = new TiptapCollabProvider({
      name: docId,
      websocketProvider,
      document: ydoc,
      onSynced: () => {
        setIsSynced(true);
        setHasSyncedOnce(true);
      },
    });

    let ackTimeout: ReturnType<typeof setTimeout> | null = null;
    const settleUnsyncedChanges = () => {
      if (ackTimeout !== null) {
        clearTimeout(ackTimeout);
      }
      // Debounced: drains once edits stop arriving, same shape as a real
      // server ack racing a burst of local updates.
      ackTimeout = setTimeout(() => {
        ackTimeout = null;
        while (newProvider.hasUnsyncedChanges) {
          newProvider.decrementUnsyncedChanges();
        }
      }, FAKE_ACK_DELAY_MS);
    };

    newProvider.on('unsyncedChanges', ({ number }: { number: number }) => {
      if (number > 0) {
        settleUnsyncedChanges();
      }
    });

    setProvider(newProvider);
    setStatus('connected');

    // No real handshake to wait on: report synced on the next tick, the way
    // a fast local connection would.
    const syncTimeout = setTimeout(() => {
      newProvider.synced = true;
    }, 0);

    return () => {
      clearTimeout(syncTimeout);
      if (ackTimeout !== null) {
        clearTimeout(ackTimeout);
      }
      newProvider.destroy();
      websocketProvider.destroy();
      setProvider(null);
    };
  }, [docId, ydoc]);

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
    hasSyncedOnce,
    user,
  };
}
