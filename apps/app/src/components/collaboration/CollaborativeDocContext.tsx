'use client';

import {
  type CollabStatus,
  type CollabUser,
  useTiptapCollab,
} from '@/hooks/useTiptapCollab';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { type ReactNode, createContext, useContext } from 'react';
import type { Doc } from 'yjs';

/**
 * Context value for collaborative document editing.
 * Provides access to the shared Yjs document and TipTap collaboration provider.
 */
interface CollaborativeDocContextValue {
  /** The shared Yjs document - all collaborative fields bind to this */
  ydoc: Doc;
  /** TipTap Cloud collaboration provider (null until connected) */
  provider: TiptapCollabProvider | null;
  /** Connection status */
  status: CollabStatus;
  /** Whether the document has synced with the server */
  isSynced: boolean;
  /** Current user info with assigned color */
  user: CollabUser;
}

const CollaborativeDocContext =
  createContext<CollaborativeDocContextValue | null>(null);

interface CollaborativeDocProviderProps {
  /** Unique document identifier for collaboration */
  docId: string;
  /** User's display name for collaboration cursors */
  userName?: string;
  children: ReactNode;
}

/**
 * Provider for collaborative document editing.
 * Creates a single Yjs document and TipTap provider shared by all child collaborative fields.
 *
 * @example
 * ```tsx
 * <CollaborativeDocProvider docId="proposal-123" userName="Alice">
 *   <CollaborativeTitleField />
 *   <CollaborativeEditor />
 * </CollaborativeDocProvider>
 * ```
 */
export function CollaborativeDocProvider({
  docId,
  userName = 'Anonymous',
  children,
}: CollaborativeDocProviderProps) {
  const { ydoc, provider, status, isSynced, user } = useTiptapCollab({
    docId,
    enabled: true,
    userName,
  });

  return (
    <CollaborativeDocContext.Provider
      value={{ ydoc, provider, status, isSynced, user }}
    >
      {children}
    </CollaborativeDocContext.Provider>
  );
}

export function useCollaborativeDoc(): CollaborativeDocContextValue {
  const ctx = useContext(CollaborativeDocContext);
  if (!ctx) {
    throw new Error(
      'useCollaborativeDoc must be used within a CollaborativeDocProvider',
    );
  }
  return ctx;
}
