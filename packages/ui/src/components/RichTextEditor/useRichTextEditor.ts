import type { Editor, Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useEffect } from 'react';

import { cn } from '../../lib/utils';
import { baseEditorStyles, defaultEditorExtensions } from './editorConfig';

export interface UseRichTextEditorProps {
  extensions?: Extensions;
  content?: string;
  editorClassName?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
}

export function useRichTextEditor({
  extensions = defaultEditorExtensions,
  content = '',
  editorClassName = '',
  onUpdate,
  onChange,
  onEditorReady,
  editable = true,
}: UseRichTextEditorProps) {
  const editor = useEditor({
    extensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          editorClassName || (editable ? 'min-h-96' : ''),
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      onChange?.(html);
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
  }, [editor]); // Only depend on editor, not content

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return editor;
}
