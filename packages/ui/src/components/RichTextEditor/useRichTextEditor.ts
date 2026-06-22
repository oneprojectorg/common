import type { JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import type { Content, Editor, Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';

import { cn } from '../../lib/utils';
import { baseEditorStyles, defaultEditorExtensions } from './editorConfig';

export function useRichTextEditor({
  extensions = defaultEditorExtensions,
  content = '',
  placeholder,
  editorClassName = '',
  onUpdate,
  onChange,
  onChangeJSON,
  onEditorReady,
  editable = true,
  required = false,
}: {
  extensions?: Extensions;
  content?: Content;
  placeholder?: string;
  editorClassName?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  /** Emits the editor's JSON doc on every update (for JSON-stored content). */
  onChangeJSON?: (content: JSONContent) => void;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
  /** When true, sets `aria-required` on the editable region for assistive tech. */
  required?: boolean;
}) {
  // Append the Placeholder extension only when a placeholder is provided, so
  // editors that don't ask for one are unaffected. Styling lives in
  // baseEditorStyles and renders the hint once when the editor is empty.
  const resolvedExtensions = useMemo(
    () =>
      placeholder
        ? [...extensions, Placeholder.configure({ placeholder })]
        : extensions,
    [extensions, placeholder],
  );

  const editor = useEditor({
    extensions: resolvedExtensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          editorClassName || (editable ? 'min-h-96' : ''),
        ),
        ...(required ? { 'aria-required': 'true' } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      onChange?.(html);
      onChangeJSON?.(editor.getJSON());
    },
    immediatelyRender: false,
  });

  // Set initial content only once when editor is first created
  useEffect(() => {
    if (editor && content) {
      const currentContent = editor.getHTML();
      if (currentContent === '' || currentContent === '<p></p>') {
        editor.commands.setContent(content);
      }
    }
  }, [editor]); // Only run when editor is ready, not on content changes

  // Readonly viewers reuse one editor instance, so sync incoming content when
  // the selected preview version changes.
  useEffect(() => {
    if (!editor || editable) {
      return;
    }

    if (!content) {
      editor.commands.clearContent();
      return;
    }

    editor.commands.setContent(content);
  }, [content, editable, editor]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return editor;
}
