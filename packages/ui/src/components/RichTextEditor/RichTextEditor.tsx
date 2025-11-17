'use client';

import type { Editor, Extensions } from '@tiptap/react';
import { forwardRef, useImperativeHandle } from 'react';

import { StyledRichTextContent } from './StyledRichTextContent';
import { useRichTextEditor } from './useRichTextEditor';

export interface RichTextEditorProps {
  extensions?: Extensions;
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
}

export interface RichTextEditorRef {
  getHTML: () => string;
  setContent: (content: string) => void;
  focus: () => void;
  blur: () => void;
  isEmpty: () => boolean;
  clear: () => void;
  editor: Editor | null;
}

export const RichTextEditor = forwardRef<
  RichTextEditorRef,
  RichTextEditorProps
>(
  (
    {
      extensions,
      content = '',
      placeholder: _placeholder = 'Start writing...',
      onUpdate,
      onChange,
      onEditorReady,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    const editor = useRichTextEditor({
      extensions,
      content,
      editorClassName,
      onUpdate,
      onChange,
      onEditorReady,
    });

    // Expose editor methods through ref
    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() || '',
        setContent: (newContent: string) =>
          editor?.commands.setContent(newContent),
        focus: () => editor?.commands.focus(),
        blur: () => editor?.commands.blur(),
        isEmpty: () => editor?.isEmpty || false,
        clear: () => editor?.commands.clearContent(),
        editor,
      }),
      [editor],
    );

    if (!editor) {
      return (
        <div className={`flex flex-1 items-center justify-center ${className}`}>
          <div className="text-neutral-charcoal">Loading editor...</div>
        </div>
      );
    }

    return (
      <div className={className}>
        <StyledRichTextContent editor={editor} placeholder={_placeholder} />
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';
