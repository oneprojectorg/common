'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';

import { useCollaborativeDoc } from './CollaborativeDocContext';
import { INVALID_EDITOR_CLASS, getFieldErrorId } from './invalidFieldStyles';

interface CollaborativeTitleFieldProps {
  placeholder?: string;
  /** When true, renders the field in its validation-error state. */
  isInvalid?: boolean;
  onChange?: (text: string) => void;
}

/**
 * A collaborative plain text field for the proposal title.
 */
export function CollaborativeTitleField({
  placeholder = 'Untitled Proposal',
  isInvalid = false,
  onChange,
}: CollaborativeTitleFieldProps) {
  const { ydoc, provider, user } = useCollaborativeDoc();

  // Build collaborative extensions for the title field
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-neutral-gray3 before:float-start before:h-0 before:pointer-events-none',
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

  const editorAttributes = useMemo(
    () => ({
      class:
        'h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal outline-none',
      ...(isInvalid
        ? {
            'aria-invalid': 'true',
            'aria-describedby': getFieldErrorId('title'),
          }
        : {}),
    }),
    [isInvalid],
  );

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: editorAttributes,
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter') {
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  // `useEditor` captures options at creation — push aria attribute changes
  // (invalid toggling after a failed submit) into the live editor.
  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: editorAttributes,
        handleKeyDown: (_view, event) => event.key === 'Enter',
      },
    });
  }, [editor, editorAttributes]);

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

  return (
    <EditorContent
      dir={editor.isEmpty ? undefined : 'auto'}
      editor={editor}
      className={cn(isInvalid && INVALID_EDITOR_CLASS)}
    />
  );
}
