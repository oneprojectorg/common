'use client';

import {
  type CollabStatus,
  type CollabUser,
  useTiptapCollab,
} from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { Doc } from 'yjs';

// How often to create a snapshot in version history
const AUTOVERSION_INTERVAL_SECONDS = 900; // 15 minutes

export interface CollaborativeEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
}

export interface CollaborativeEditorProps {
  docId: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  /** Called when the collaboration provider is ready */
  onProviderReady?: (provider: TiptapCollabProvider) => void;
  className?: string;
  editorClassName?: string;
  user?: CollabUser;
}

/** Rich text editor with real-time collaboration via TipTap Cloud */
export const CollaborativeEditor = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorProps
>(
  (
    {
      docId,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      onProviderReady,
      className = '',
      editorClassName = '',
      user,
    },
    ref,
  ) => {
    const { ydoc, provider, status, isSynced } = useTiptapCollab({
      docId,
      enabled: true,
      user,
    });

    // Notify parent when provider becomes available
    useEffect(() => {
      if (provider && onProviderReady) {
        onProviderReady(provider);
      }
    }, [provider, onProviderReady]);

    // Wait for provider before rendering the editor inner component
    // This ensures Snapshot extension is included from the start
    if (!provider) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <CollaborativeEditorInner
        ref={ref}
        ydoc={ydoc}
        provider={provider}
        status={status}
        isSynced={isSynced}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={onEditorReady}
        className={className}
        editorClassName={editorClassName}
        user={user}
      />
    );
  },
);

type CollaborativeEditorInnerProps = Omit<CollaborativeEditorProps, 'docId'> & {
  ydoc: Doc;
  provider: TiptapCollabProvider;
  status: CollabStatus;
  isSynced: boolean;
};

const DEFAULT_USER: CollabUser = {
  name: 'Anonymous',
  color: '#f783ac',
};

const CollaborativeEditorInner = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorInnerProps
>(
  (
    {
      ydoc,
      provider,
      status,
      isSynced,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
      user,
    },
    ref,
  ) => {
    // Build collaborative extensions with cursor support
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({
          provider,
          user: user ?? DEFAULT_USER,
        }),
        Snapshot.configure({ provider }),
      ],
      [extensions, ydoc, provider, user],
    );

    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      editorClassName,
      onEditorReady,
    });

    // Track whether versioning has been enabled to avoid toggling it off on re-render
    const versioningEnabledRef = useRef(false);

    // Enable autoversioning when editor is ready and connected
    useEffect(() => {
      if (!editor || status !== 'connected' || versioningEnabledRef.current) {
        return;
      }

      const configMap = ydoc.getMap<number>('__tiptapcollab__config');
      configMap.set('intervalSeconds', AUTOVERSION_INTERVAL_SECONDS);

      editor.commands.toggleVersioning();
      versioningEnabledRef.current = true;
    }, [editor, status, ydoc]);

    useImperativeHandle(
      ref,
      () => ({
        editor,
        collabStatus: status,
        isSynced,
      }),
      [editor, status, isSynced],
    );

    if (!editor) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <div className={className}>
        <StyledRichTextContent editor={editor} placeholder={placeholder} />
      </div>
    );
  },
);

CollaborativeEditorInner.displayName = 'CollaborativeEditorInner';

CollaborativeEditor.displayName = 'CollaborativeEditor';
