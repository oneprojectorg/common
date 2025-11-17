'use client';

import { useEditor } from '@tiptap/react';

import { StyledRichTextContent } from './StyledRichTextContent';
import { getViewerExtensions } from './editorConfig';

// TODO: this will be replaced entirely by a new viewer that has no dependency on TipTap
export interface RichTextViewerContentProps {
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
export function RichTextViewerContent({
  content,
  className = '',
  editorClassName = '',
  immediatelyRender = false,
}: RichTextViewerContentProps) {
  const editor = useEditor({
    extensions: getViewerExtensions(),
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
