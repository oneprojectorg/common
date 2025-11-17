import type { Editor, Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useEffect } from 'react';

import { cn } from '../../lib/utils';
import { defaultEditorExtensions } from './editorConfig';

export interface UseRichTextEditorProps {
  extensions?: Extensions;
  content?: string;
  editorClassName?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  immediatelyRender?: boolean;
}

export function useRichTextEditor({
  extensions = defaultEditorExtensions,
  content = '',
  editorClassName = '',
  onUpdate,
  onChange,
  onEditorReady,
  immediatelyRender = false,
}: UseRichTextEditorProps) {
  const editor = useEditor({
    extensions,
    content,
    editable: true,
    editorProps: {
      attributes: {
        class: cn(
          'overflow-wrap-anywhere max-w-none break-words focus:outline-none [&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline [&_h1]:text-teal',
          editorClassName ||
            'min-h-96 px-6 py-6 text-neutral-black placeholder:text-neutral-gray2',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      onChange?.(html);
    },
    immediatelyRender,
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
