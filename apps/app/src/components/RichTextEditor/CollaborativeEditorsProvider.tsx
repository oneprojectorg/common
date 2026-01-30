'use client';

import {
  type CollabStatus,
  type CollabUser,
  useTiptapCollab,
} from '@/hooks/useTiptapCollab';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Doc } from 'yjs';

interface CollaborativeEditorsContextValue {
  ydoc: Doc;
  provider: TiptapCollabProvider | null;
  status: CollabStatus;
  isSynced: boolean;
  user: CollabUser;
}

const CollaborativeEditorsContext =
  createContext<CollaborativeEditorsContextValue | null>(null);

export interface CollaborativeEditorsProviderProps {
  /** Unique document identifier for collaboration */
  docId: string;
  /** User's display name for collaboration cursors */
  userName?: string;
  /** Called when the collaboration provider is ready */
  onProviderReady?: (provider: TiptapCollabProvider) => void;
  children: ReactNode;
}

/**
 * Provider that manages a shared Yjs document for multiple collaborative editors.
 * Wrap multiple `FragmentEditor` components with this provider to have them
 * share the same document while editing different fragments.
 */
export function CollaborativeEditorsProvider({
  docId,
  userName = 'Anonymous',
  onProviderReady,
  children,
}: CollaborativeEditorsProviderProps) {
  const { ydoc, provider, status, isSynced, user } = useTiptapCollab({
    docId,
    enabled: true,
    userName,
  });

  // Notify parent when provider becomes available
  useEffect(() => {
    if (provider && onProviderReady) {
      onProviderReady(provider);
    }
  }, [provider, onProviderReady]);

  return (
    <CollaborativeEditorsContext.Provider
      value={{ ydoc, provider, status, isSynced, user }}
    >
      {children}
    </CollaborativeEditorsContext.Provider>
  );
}

/**
 * Hook to access the shared collaborative editing context.
 * Must be used within a CollaborativeEditorsProvider.
 */
export function useCollaborativeEditors(): CollaborativeEditorsContextValue {
  const context = useContext(CollaborativeEditorsContext);
  if (!context) {
    throw new Error(
      'useCollaborativeEditors must be used within a CollaborativeEditorsProvider',
    );
  }
  return context;
}
