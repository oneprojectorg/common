'use client';

import {
  RichTextEditor,
  type RichTextEditorRef,
} from '@op/ui/RichTextEditor';
import type { Editor } from '@tiptap/react';
import { forwardRef, useRef, useState } from 'react';

import { getEditorExtensions } from './editorConfig';
import { RichTextEditorToolbar } from './RichTextEditorToolbar';

export interface RichTextEditorWithToolbarProps {
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

export const RichTextEditorWithToolbar = forwardRef<RichTextEditorRef, RichTextEditorWithToolbarProps>(({
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

      <RichTextEditor
        ref={ref || editorRef}
        extensions={getEditorExtensions()}
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

RichTextEditorWithToolbar.displayName = 'RichTextEditorWithToolbar';