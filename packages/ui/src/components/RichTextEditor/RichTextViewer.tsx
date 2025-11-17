'use client';

import type { Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';

import { defaultViewerExtensions } from './editorConfig';
import { StyledRichTextContent } from './StyledRichTextContent';

// TODO: this will be replaced entirely by a new viewer that has no dependency on TipTap
export interface RichTextViewerProps {
  extensions?: Extensions;
  content: string;
  className?: string;
  editorClassName?: string;
  immediatelyRender?: boolean;
}

/**
 * Read-only viewer component for displaying rich text content.
 * Use this for displaying content that should not be edited.
 * Links will open on click.
 */
export function RichTextViewer({
  extensions = defaultViewerExtensions,
  content,
  className = '',
  editorClassName = '',
  immediatelyRender = false,
}: RichTextViewerProps) {
  const editor = useEditor({
    extensions,
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: `max-w-none focus:outline-none ${editorClassName || 'px-6 py-6 text-neutral-black'}`,
      },
    },
    immediatelyRender,
  });

  if (!editor) {
    return (
      <div className={`flex flex-1 items-center justify-center ${className}`}>
        <div className="text-gray-500">Loading content...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <StyledRichTextContent editor={editor} />
    </div>
  );
}
