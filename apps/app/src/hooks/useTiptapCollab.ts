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

const REJECTED_TOAST_ID = 'collab-token-rejected';

export interface CollabUser {
  name: string;
  color: string;
}

export interface UseTiptapCollabOptions {
  docId: string;
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

/** Initialize TipTap Cloud collaboration provider. Suspends on the first token fetch. */
export function useTiptapCollab({
  docId,
  proposalProfileId,
  userName = 'Anonymous',
}: UseTiptapCollabOptions): UseTiptapCollabReturn {
  const t = useTranslations();

  const getToken = useProposalCollabToken({ proposalProfileId });

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

    const newProvider = new TiptapCollabProvider({
      name: docId,
      appId,
      token: getToken,
      document: ydoc,
      onConnect: () => {
        setStatus('connected');
      },
      onAuthenticated: () => {
        toast.dismiss(REJECTED_TOAST_ID);
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
        // The provider reconnects on its own and fetches a fresh token.
        logger.warn('Tiptap collaboration rejected the token', {
          context: 'useTiptapCollab',
          docId,
        });
        toast.error(
          t(
            'Could not reconnect to this document. Reload the page to try again.',
          ),
          { id: REJECTED_TOAST_ID },
        );
      },
    });

    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      setProvider(null);
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
    user,
  };
}
