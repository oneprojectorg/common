'use client';

import type { JSONContent } from '@tiptap/core';
import type { Content, Editor, Extensions } from '@tiptap/react';
import { forwardRef, useImperativeHandle } from 'react';

import { RichTextEditorSkeleton } from './RichTextEditorSkeleton';
import { StyledRichTextContent } from './StyledRichTextContent';
import { useRichTextEditor } from './useRichTextEditor';

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
  {
    extensions?: Extensions;
    /** HTML string or a TipTap JSON doc (the editor seeds from either). */
    content?: Content;
    placeholder?: string;
    /** Translated hint for an empty Details summary (see useRichTextEditor). */
    summaryPlaceholder?: string;
    /**
     * Emits the editor HTML on every update. `onUpdate` and `onChange` are
     * intentional aliases (same value, same timing) kept for @op/ui migration
     * — wire only one.
     */
    onUpdate?: (content: string) => void;
    onChange?: (content: string) => void;
    /** Emits the editor's JSON doc on every update (for JSON-stored content). */
    onChangeJSON?: (content: JSONContent) => void;
    onEditorReady?: (editor: Editor) => void;
    /** Sets `aria-required` on the editable region for assistive tech. */
    required?: boolean;
    className?: string;
    editorClassName?: string;
  }
>(
  (
    {
      extensions,
      content = '',
      placeholder,
      summaryPlaceholder,
      onUpdate,
      onChange,
      onChangeJSON,
      onEditorReady,
      required,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    const editor = useRichTextEditor({
      extensions,
      content,
      placeholder,
      summaryPlaceholder,
      editorClassName,
      onUpdate,
      onChange,
      onChangeJSON,
      onEditorReady,
      required,
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
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <div className={className}>
        <StyledRichTextContent
          dir={editor.isEmpty ? undefined : 'auto'}
          editor={editor}
        />
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';
