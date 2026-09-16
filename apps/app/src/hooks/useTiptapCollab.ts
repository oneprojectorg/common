'use client';

import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { getAvatarColorForString } from '@op/styles/constants';
import { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

import { useTranslations } from '@/lib/i18n';

import { useProposalCollabToken } from './useProposalCollabToken';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabUser {
  name: string;
  color: string;
}

export interface UseTiptapCollabOptions {
  docId: string;
  /** The proposal that owns `docId`; its collaboration token gates the socket. */
  proposalProfileId: string;
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

/**
 * Initialize TipTap Cloud collaboration provider.
 *
 * The first token fetch is a suspense query, so mount this under a Suspense
 * and a resource error boundary.
 */
export function useTiptapCollab({
  docId,
  proposalProfileId,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const t = useTranslations();

  // The provider awaits `getToken` on every authentication, so a reconnect
  // picks up a fresh token without the Y.Doc being torn down. It is memoized —
  // a new function identity would rebuild the provider.
  const { getToken, refreshToken } = useProposalCollabToken({
    proposalProfileId,
  });

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
    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    if (!appId) {
      logger.error('NEXT_PUBLIC_TIPTAP_APP_ID not set', {
        context: 'useTiptapCollab',
      });
      setStatus('disconnected');
      return;
    }

    // A rejected token is most likely stale, so the first rejection drops the
    // cached token and reconnects. A second rejection in a row means the fresh
    // token was refused too, so the user is told and the retry loop stops.
    let rejections = 0;

    const newProvider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: getToken,
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
      },
      onSynced: () => {
        setIsSynced(true);
      },
      onAuthenticationFailed: () => {
        setStatus('disconnected');
        setIsSynced(false);
        rejections += 1;

        if (rejections === 1) {
          refreshToken();
          newProvider.disconnect();
          void newProvider.connect();
          return;
        }

        logger.warn('Tiptap collaboration rejected a fresh token', {
          context: 'useTiptapCollab',
          docId,
        });
        toast.error(
          t(
            'Could not reconnect to this document. Reload the page to try again.',
          ),
        );
        newProvider.disconnect();
      },
    });

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
    };
  }, [docId, getToken, refreshToken, t, ydoc]);

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
