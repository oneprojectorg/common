'use client';

import {
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import { getAvatarColorForString } from '@op/ui/utils';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import type { Doc } from 'yjs';

export interface CollaborativeEditorWithFragmentProps {
  /** The shared Yjs document */
  ydoc: Doc;
  /** The TipTap Cloud provider */
  provider: TiptapCollabProvider;
  /** The field/fragment name within the Y.Doc - allows multiple editors to coexist */
  field: string;
  /** Base extensions (without collaboration) */
  extensions?: Extensions;
  /** Placeholder text */
  placeholder?: string;
  /** Called when editor content changes (returns HTML) */
  onChange?: (html: string) => void;
  /** Called when editor is ready */
  onEditorReady?: (editor: Editor) => void;
  /** Container className */
  className?: string;
  /** Editor content className */
  editorClassName?: string;
  /** User name for collaboration cursor */
  userName?: string;
}

/**
 * A collaborative editor that uses a specific fragment within a Y.Doc.
 * This allows multiple rich text editors to share the same collaboration document
 * while maintaining separate content via TipTap's `field` parameter.
 */
export function CollaborativeEditorWithFragment({
  ydoc,
  provider,
  field,
  extensions = [],
  placeholder = 'Start writing...',
  onChange,
  onEditorReady,
  className = '',
  editorClassName = '',
  userName = 'Anonymous',
}: CollaborativeEditorWithFragmentProps) {
  // Derive color from username
  const user = useMemo(() => {
    const { hex } = getAvatarColorForString(userName);
    return { name: userName, color: hex };
  }, [userName]);

  // Build collaborative extensions with the specific field
  // Only pass field if it's not 'default' - omitting field uses the default fragment
  const collaborativeExtensions = useMemo(() => {
    const collabConfig =
      field && field !== 'default'
        ? { document: ydoc, field }
        : { document: ydoc };

    return [
      ...extensions,
      Collaboration.configure(collabConfig),
      CollaborationCaret.configure({
        provider,
        user,
      }),
    ];
  }, [extensions, ydoc, field, provider, user]);

  const editor = useRichTextEditor({
    extensions: collaborativeExtensions,
    editorClassName,
    onEditorReady,
  });

  // Track content changes
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (!editor || !onChange) {
      return;
    }

    const handleUpdate = () => {
      if (isInternalUpdate.current) {
        return;
      }
      const html = editor.getHTML();
      onChange(html);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange]);

  if (!editor) {
    return (
      <div className={className}>
        <div className="min-h-52 animate-pulse bg-neutral-gray1" />
      </div>
    );
  }

  return (
    <div className={className}>
      <StyledRichTextContent editor={editor} placeholder={placeholder} />
    </div>
  );
}
