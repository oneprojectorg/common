'use client';

import type { Extensions } from '@tiptap/react';

import { StyledRichTextContent } from './StyledRichTextContent';
import { defaultViewerExtensions } from './editorConfig';
import { useRichTextEditor } from './useRichTextEditor';

// TODO: this will be replaced entirely by a new viewer that has no dependency on TipTap
export interface RichTextViewerProps {
  extensions?: Extensions;
  content: string;
  className?: string;
  editorClassName?: string;
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
}: RichTextViewerProps) {
  const editor = useRichTextEditor({
    extensions,
    content,
    editorClassName,
    editable: false,
  });

  if (!editor) {
    return (
      <div className={`flex flex-1 items-center justify-center ${className}`}>
        <div className="text-neutral-charcoal">Loading content...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <StyledRichTextContent editor={editor} />
    </div>
  );
}
