'use client';

import { Skeleton } from '@op/ui/Skeleton';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeTitleFieldProps {
  placeholder?: string;
  onChange?: (text: string) => void;
}

/**
 * A collaborative plain text field for the proposal title.
 */
export function CollaborativeTitleField({
  placeholder = 'Untitled Proposal',
  onChange,
}: CollaborativeTitleFieldProps) {
  const { ydoc, provider, user } = useCollaborativeDoc();

  console.log('[CollaborativeTitleField] binding to Yjs fragment: title');

  // Build collaborative extensions for the title field
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-neutral-gray3 before:float-left before:h-0 before:pointer-events-none',
      }),
      Collaboration.configure({
        document: ydoc,
        field: 'title',
      }),
      CollaborationCaret.configure({
        provider,
        user,
      }),
    ],
    [ydoc, provider, user, placeholder],
  );

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class:
          'h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter') {
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || !onChange) {
      return;
    }

    const handleUpdate = () => {
      const plainText = editor.getText().trim();
      onChange(plainText);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange]);

  if (!editor) {
    return <Skeleton className="h-8" />;
  }

  return <EditorContent editor={editor} />;
}
