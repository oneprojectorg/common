import type { JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import type { Content, Editor, Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';

import { cn } from '../../lib/utils';
import {
  baseEditorStyles,
  defaultEditorExtensions,
  linePlaceholderStyles,
} from './editorConfig';

export function useRichTextEditor({
  extensions = defaultEditorExtensions,
  content = '',
  placeholder,
  linePlaceholder,
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
  /**
   * Notion-style per-empty-line hint (e.g. "Start typing or press '/' for more
   * commands…"). When set, the placeholder follows the cursor: the editor-level
   * `placeholder` shows while the whole editor is empty, this shows on any other
   * empty line. Opt-in — omit it and placeholder behavior is unchanged.
   */
  linePlaceholder?: string;
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
  // Append the Placeholder extension only when a hint is asked for, so editors
  // that don't ask for one are unaffected. With a `linePlaceholder` the config
  // switches to the function form so the hint follows the cursor (editor-level
  // text while empty, line-level text on any other empty line). Styling lives in
  // baseEditorStyles (+ linePlaceholderStyles, added to the class below).
  const resolvedExtensions = useMemo(() => {
    if (!placeholder && !linePlaceholder) {
      return extensions;
    }

    if (linePlaceholder) {
      return [
        ...extensions,
        Placeholder.configure({
          showOnlyCurrent: true,
          placeholder: ({ editor }) =>
            editor.isEmpty ? (placeholder ?? '') : linePlaceholder,
        }),
      ];
    }

    return [...extensions, Placeholder.configure({ placeholder })];
  }, [extensions, placeholder, linePlaceholder]);

  const editor = useEditor({
    extensions: resolvedExtensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          linePlaceholder ? linePlaceholderStyles : '',
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
