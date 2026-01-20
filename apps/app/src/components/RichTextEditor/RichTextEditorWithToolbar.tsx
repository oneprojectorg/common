'use client';

import { RichTextEditor, type RichTextEditorRef } from '@op/ui/RichTextEditor';
import type { Editor } from '@tiptap/react';
import { forwardRef, useMemo, useRef, useState } from 'react';

import { RichTextEditorToolbar } from './RichTextEditorToolbar';
import {
  type EditorExtensionOptions,
  getProposalExtensions,
} from './editorConfig';

export interface RichTextEditorWithToolbarProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  className?: string;
  editorClassName?: string;
  showToolbar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
  /** Extension options (slash commands, link embeds, etc.) */
  extensionOptions?: EditorExtensionOptions;
}

/**
 * Rich text editor with formatting toolbar.
 *
 * This is a non-collaborative editor for local editing use cases.
 * For real-time collaboration, use `CollaborativeEditor` instead.
 *
 * @example
 * ```tsx
 * <RichTextEditorWithToolbar
 *   content={content}
 *   onUpdate={setContent}
 *   showToolbar={true}
 * />
 * ```
 */
export const RichTextEditorWithToolbar = forwardRef<
  RichTextEditorRef,
  RichTextEditorWithToolbarProps
>(
  (
    {
      content = '',
      placeholder,
      onUpdate,
      onChange,
      className = '',
      editorClassName = '',
      showToolbar = true,
      toolbarPosition = 'top',
      extensionOptions,
    },
    ref,
  ) => {
    const editorRef = useRef<RichTextEditorRef>(null);
    const [editor, setEditor] = useState<Editor | null>(null);

    // Memoize extensions to avoid recreating on every render
    const extensions = useMemo(
      () => getProposalExtensions(extensionOptions),
      [extensionOptions],
    );

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
          extensions={extensions}
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
            className="border-t border-b-0"
          />
        )}
      </div>
    );
  },
);

RichTextEditorWithToolbar.displayName = 'RichTextEditorWithToolbar';
