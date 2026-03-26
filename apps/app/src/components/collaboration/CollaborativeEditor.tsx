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
import { forwardRef, useImperativeHandle, useMemo } from 'react';

import { useCollaborativeDoc } from './CollaborativeDocContext';

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
