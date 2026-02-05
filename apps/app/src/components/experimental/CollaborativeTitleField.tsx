'use client';

import { getAvatarColorForString } from '@op/ui/utils';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Doc } from 'yjs';

import { getPlainTextExtensions } from './plainTextExtensions';

interface CollaborativeTitleFieldProps {
  /** The shared Yjs document */
  ydoc: Doc;
  /** The TipTap Cloud provider */
  provider: TiptapCollabProvider;
  /** Placeholder text */
  placeholder?: string;
  /** Called when content changes (returns plain text) */
  onChange?: (text: string) => void;
  /** User name for collaboration cursor */
  userName?: string;
  /** Additional className for the editor */
  className?: string;
}

/**
 * A collaborative plain text field for the proposal title.
 * Uses TipTap with minimal extensions for proper cursor sync.
 */
export function CollaborativeTitleField({
  ydoc,
  provider,
  placeholder = 'Untitled Proposal',
  onChange,
  userName = 'Anonymous',
  className = '',
}: CollaborativeTitleFieldProps) {
  // Derive color from username
  const user = useMemo(() => {
    const { hex } = getAvatarColorForString(userName);
    return { name: userName, color: hex };
  }, [userName]);

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

  const extractPlainText = useCallback((html: string) => {
    return html.replace(/<[^>]*>/g, '').trim();
  }, []);

  useEffect(() => {
    if (!editor || !onChange) {
      return;
    }

    const handleUpdate = () => {
      if (isInternalUpdate.current) {
        return;
      }
      const html = editor.getHTML();
      const plainText = extractPlainText(html);
      onChange(plainText);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange, extractPlainText]);

  if (!editor) {
    return <div className="h-8 animate-pulse rounded bg-neutral-gray1" />;
  }

  return <EditorContent editor={editor} />;
}
