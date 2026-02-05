'use client';

import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';

import { useCollaborativeDoc } from '../RichTextEditor/CollaborativeDocContext';
import { getPlainTextExtensions } from './plainTextExtensions';

interface CollaborativeTitleFieldProps {
  /** Placeholder text */
  placeholder?: string;
  /** Called when content changes (returns plain text) */
  onChange?: (text: string) => void;
  /** Additional className for the editor */
  className?: string;
}

/**
 * A collaborative plain text field for the proposal title.
 * Uses TipTap with minimal extensions for proper cursor sync.
 * Must be used within a CollaborativeDocProvider.
 *
 * @example
 * ```tsx
 * <CollaborativeDocProvider docId="proposal-123" userName="Alice">
 *   <CollaborativeTitleField
 *     placeholder="Untitled Proposal"
 *     onChange={setTitle}
 *   />
 * </CollaborativeDocProvider>
 * ```
 */
export function CollaborativeTitleField({
  placeholder = 'Untitled Proposal',
  onChange,
  className = '',
}: CollaborativeTitleFieldProps) {
  const { ydoc, provider, user } = useCollaborativeDoc();

  // Build collaborative extensions for the title field
  const extensions = useMemo(() => {
    const baseExtensions = getPlainTextExtensions({ collaborative: true });

    return [
      ...baseExtensions,
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
    ];
  }, [ydoc, provider, user, placeholder]);

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class: `h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal focus:outline-none ${className}`,
      },
    },
    immediatelyRender: false,
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
      const plainText = editor.getText().trim();
      onChange(plainText);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange]);

  if (!editor) {
    return <div className="h-8 animate-pulse rounded bg-neutral-gray1" />;
  }

  return <EditorContent editor={editor} />;
}
