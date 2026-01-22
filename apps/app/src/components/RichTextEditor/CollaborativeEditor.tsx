'use client';

import { type CollabStatus, useTiptapCollab } from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Collaboration from '@tiptap/extension-collaboration';
import type { Editor, Extensions } from '@tiptap/react';
import { forwardRef, useImperativeHandle, useMemo } from 'react';

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
    const { ydoc, status, isSynced } = useTiptapCollab({
      docId,
      enabled: true,
    });

    const collaborativeExtensions = useMemo(
      () => [...extensions, Collaboration.configure({ document: ydoc })],
      [extensions, ydoc],
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
