'use client';

import type { CollabStatus } from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
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

import { useCollaborativeDoc } from './CollaborativeDocContext';

// How often to create a snapshot in version history
const AUTOVERSION_INTERVAL_SECONDS = 900; // 15 minutes

export interface CollaborativeEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
}

export interface CollaborativeEditorProps {
  /** The Yjs field name to bind to (defaults to 'default' for main content) */
  field?: string;
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
      field = 'default',
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    const { ydoc, provider, status, isSynced, user } = useCollaborativeDoc();

    console.log('[CollaborativeEditor] binding to Yjs fragment:', field);

    // Build collaborative extensions with cursor support
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc, field }),
        CollaborationCaret.configure({
          provider,
          user,
        }),
        Snapshot.configure({ provider }),
      ],
      [extensions, ydoc, field, provider, user],
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

CollaborativeEditor.displayName = 'CollaborativeEditor';
