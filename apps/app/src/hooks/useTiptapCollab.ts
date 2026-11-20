'use client';

import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { getAvatarColorForString } from '@op/styles/constants';
import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

import { useTranslations } from '@/lib/i18n';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

/** The first rejection is a normal token expiry. */
const MAX_TOKEN_REJECTIONS = 3;

/** Thrown by `getToken` when the server no longer lets the user edit the document. */
export class CollabAccessDeniedError extends Error {}

export interface CollabUser {
  name: string;
  color: string;
}

export interface UseTiptapCollabOptions {
  docId: string;
  /**
   * Called on every connect; must be referentially stable. Reject with
   * `CollabAccessDeniedError` to stop reconnecting.
   */
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
  /** The server refused a token: the user can no longer edit the document. */
  isAccessDenied: boolean;
  /** User object with assigned color for this session */
  user: CollabUser;
}

/** Initialize TipTap Cloud collaboration provider. */
export function useTiptapCollab({
  docId,
  getToken,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const t = useTranslations('editor');

  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  // Derive color from username - matches Avatar gradient
  const user = useMemo<CollabUser>(() => {
    const { hex } = getAvatarColorForString(userName);
    return { name: userName, color: hex };
  }, [userName]);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    if (!appId) {
      logger.error('NEXT_PUBLIC_TIPTAP_APP_ID not set', {
        context: 'useTiptapCollab',
      });
      setStatus('disconnected');
      return;
    }

    // Tiptap keeps the socket open after rejecting a token, and `connect()` is
    // a no-op until the close handler runs; reconnect starts in `onDisconnect`.
    let rejections = 0;
    let reconnectAfterClose = false;
    // A refused token request also reaches `onAuthenticationFailed`, but a new
    // token will not fix it, so it must not count as an expiry.
    let accessDenied = false;

    const newProvider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: () =>
        getToken().catch((error: unknown) => {
          accessDenied = error instanceof CollabAccessDeniedError;
          throw error;
        }),
      document: ydoc,
      onConnect: () => {
        setStatus('connected');
      },
      onAuthenticated: () => {
        rejections = 0;
      },
      onDisconnect: () => {
        setStatus('disconnected');
        setIsSynced(false);

        if (reconnectAfterClose) {
          reconnectAfterClose = false;
          void newProvider.connect();
        }
      },
      onSynced: () => {
        setIsSynced(true);
      },
      onAuthenticationFailed: () => {
        if (accessDenied) {
          setIsAccessDenied(true);
          newProvider.disconnect();
          return;
        }

        rejections += 1;

        if (rejections < MAX_TOKEN_REJECTIONS) {
          reconnectAfterClose = true;
        } else {
          logger.warn('Tiptap collaboration rejected the token repeatedly', {
            context: 'useTiptapCollab',
            docId,
          });
          toast.error(t('reconnectError'));
        }

        newProvider.disconnect();
      },
    });

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
      setIsAccessDenied(false);
    };
  }, [docId, getToken, t, ydoc]);

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
    isAccessDenied,
    user,
  };
}
