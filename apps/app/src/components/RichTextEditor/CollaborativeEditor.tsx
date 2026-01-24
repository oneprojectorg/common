'use client';

import {
  type CollabStatus,
  type SaveStatus,
  useTiptapCollab,
} from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import Collaboration from '@tiptap/extension-collaboration';
import type { Editor, Extensions } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';

/** Autoversioning interval in seconds (creates snapshot every 30s if document changed) */
const AUTOVERSION_INTERVAL_SECONDS = 3;

export interface CollaborativeEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
}

export interface CollaborativeEditorProps {
  docId: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
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
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    const { ydoc, provider, status, isSynced, saveStatus, lastSavedAt } =
      useTiptapCollab({
        docId,
        enabled: true,
      });

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
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={onEditorReady}
        className={className}
        editorClassName={editorClassName}
      />
    );
  },
);

interface CollaborativeEditorInnerProps {
  ydoc: import('yjs').Doc;
  provider: import('@tiptap-pro/provider').TiptapCollabProvider;
  status: CollabStatus;
  isSynced: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
}

/** Inner component that renders after provider is ready */
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
      saveStatus,
      lastSavedAt,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc }),
        Snapshot.configure({
          provider,
          onUpdate: (payload) => {
            console.log('[Snapshot] onUpdate:', payload);
          },
        }),
      ],
      [extensions, ydoc, provider],
    );

    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      editorClassName,
      onEditorReady,
    });

    // Enable autoversioning when editor is ready and connected
    useEffect(() => {
      if (!editor || status !== 'connected') {
        return;
      }

      // Configure autoversioning interval on the ydoc
      const configMap = ydoc.getMap<number>('__tiptapcollab__config');
      configMap.set('intervalSeconds', AUTOVERSION_INTERVAL_SECONDS);

      // Enable autoversioning
      if (editor.commands.toggleVersioning) {
        console.log('[CollaborativeEditor] Enabling autoversioning');
        editor.commands.toggleVersioning();
      }
    }, [editor, status, ydoc]);

    useImperativeHandle(
      ref,
      () => ({
        editor,
        collabStatus: status,
        isSynced,
        saveStatus,
        lastSavedAt,
      }),
      [editor, status, isSynced, saveStatus, lastSavedAt],
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
