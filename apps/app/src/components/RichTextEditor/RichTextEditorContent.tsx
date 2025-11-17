'use client';

import { Editor } from '@tiptap/react';
import { forwardRef, useImperativeHandle } from 'react';

import { StyledRichTextContent } from './StyledRichTextContent';
import { useRichTextEditor } from './useRichTextEditor';

export interface RichTextEditorContentProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
  immediatelyRender?: boolean;
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

export const RichTextEditorContent = forwardRef<
  RichTextEditorRef,
  RichTextEditorContentProps
>(
  (
    {
      content = '',
      placeholder: _placeholder = 'Start writing...',
      onUpdate,
      onChange,
      onEditorReady,
      className = '',
      editorClassName = '',
      immediatelyRender = false,
    },
    ref,
  ) => {
    const editor = useRichTextEditor({
      content,
      editorClassName,
      onUpdate,
      onChange,
      onEditorReady,
      immediatelyRender,
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
          <div className="text-gray-500">Loading editor...</div>
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

RichTextEditorContent.displayName = 'RichTextEditorContent';
