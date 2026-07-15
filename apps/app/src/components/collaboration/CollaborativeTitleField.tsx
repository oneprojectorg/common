'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { cn, getInvalidAriaAttributes } from '@op/ui/utils';
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

/** Titles are single-line — swallow Enter instead of inserting a paragraph. */
function suppressEnterKey(_view: unknown, event: KeyboardEvent): boolean {
  return event.key === 'Enter';
}

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

  // Memoized so `useEditor`'s per-render options diff only applies changes
  // (aria-invalid toggling after a failed submit) when they actually change.
  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          'h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal outline-none',
        ...getInvalidAriaAttributes({
          isInvalid,
          errorMessageId: getFieldErrorId('title'),
        }),
      },
      handleKeyDown: suppressEnterKey,
    }),
    [isInvalid],
  );

  const editor = useEditor({
    extensions,
    editorProps,
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

  return (
    <EditorContent
      dir={editor.isEmpty ? undefined : 'auto'}
      editor={editor}
      className={cn(isInvalid && INVALID_EDITOR_CLASS)}
    />
  );
}
