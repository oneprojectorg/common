'use client';

import { RichTextEditor, type RichTextEditorRef } from '@op/ui/RichTextEditor';
import type { Editor } from '@tiptap/react';
import { forwardRef, useRef, useState } from 'react';

import { RichTextEditorToolbar } from './RichTextEditorToolbar';
import { getEditorExtensions } from './editorConfig';

export interface RichTextEditorWithToolbarProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  className?: string;
  editorClassName?: string;
  showToolbar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
}

export const RichTextEditorWithToolbar = forwardRef<
  RichTextEditorRef,
  RichTextEditorWithToolbarProps
>(
  (
    {
      content = '',
      placeholder = 'Start writing...',
      onUpdate,
      onChange,
      className = '',
      editorClassName = '',
      showToolbar = true,
      toolbarPosition = 'top',
    },
    ref,
  ) => {
    const editorRef = useRef<RichTextEditorRef>(null);
    const [editor, setEditor] = useState<Editor | null>(null);

    const handleEditorReady = (editorInstance: Editor) => {
      setEditor(editorInstance);
    };

    return (
      <div className={className}>
        {showToolbar && toolbarPosition === 'top' && (
          <RichTextEditorToolbar editor={editor} />
        )}

        <RichTextEditor
          ref={ref || editorRef}
          extensions={getEditorExtensions()}
          content={content}
          placeholder={placeholder}
          onUpdate={onUpdate}
          onChange={onChange}
          onEditorReady={handleEditorReady}
          editorClassName={editorClassName}
        />

        {showToolbar && toolbarPosition === 'bottom' && (
          <RichTextEditorToolbar
            editor={editor}
            className="border-b-0 border-t"
          />
        )}
      </div>
    );
  },
);

RichTextEditorWithToolbar.displayName = 'RichTextEditorWithToolbar';
