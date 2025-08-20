'use client';

import { forwardRef } from 'react';

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
  readOnly?: boolean;
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
  readOnly = false,
  immediatelyRender = false,
}, ref) => {
  return (
    <div className={className}>
      {showToolbar && (
        <RichTextEditorToolbar
          editor={null} // Will be passed from parent if needed
        />
      )}

      <RichTextEditorContent
        ref={ref}
        content={content}
        placeholder={placeholder}
        onUpdate={onUpdate}
        onChange={onChange}
        editorClassName={editorClassName}
        readOnly={readOnly}
        immediatelyRender={immediatelyRender}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';