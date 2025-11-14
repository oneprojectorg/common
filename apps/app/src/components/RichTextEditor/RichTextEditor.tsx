'use client';

import { forwardRef, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import { RichTextEditorContent, type RichTextEditorRef } from './RichTextEditorContent';
import { RichTextEditorToolbar } from './RichTextEditorToolbar';

export interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  className?: string;
  editorClassName?: string;
  showToolbar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
  immediatelyRender?: boolean;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  content = '',
  placeholder = 'Start writing...',
  onUpdate,
  onChange,
  className = '',
  editorClassName = '',
  showToolbar = true,
  toolbarPosition = 'top',
  immediatelyRender = false,
}, ref) => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleEditorReady = (editorInstance: Editor) => {
    setEditor(editorInstance);
  };

  return (
    <div className={className}>
      {showToolbar && toolbarPosition === 'top' && (
        <RichTextEditorToolbar
          editor={editor}
        />
      )}

      <RichTextEditorContent
        ref={ref || editorRef}
        content={content}
        placeholder={placeholder}
        onUpdate={onUpdate}
        onChange={onChange}
        onEditorReady={handleEditorReady}
        editorClassName={editorClassName}
        immediatelyRender={immediatelyRender}
      />

      {showToolbar && toolbarPosition === 'bottom' && (
        <RichTextEditorToolbar
          editor={editor}
          className="border-t border-b-0"
        />
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';