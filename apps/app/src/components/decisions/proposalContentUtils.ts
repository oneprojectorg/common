import type { proposalEncoder } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { defaultViewerExtensions } from '@op/ui/RichTextEditor';
import { type JSONContent, generateText } from '@tiptap/core';
import type { Content } from '@tiptap/react';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;
type DocumentContent = NonNullable<Proposal['documentContent']>;

/**
 * Extracts content from proposal documentContent for use with RichTextViewer.
 * Returns Content for rendering, or null if no content available.
 */
export function getProposalContent(
  documentContent?: DocumentContent,
): Content | null {
  if (!documentContent) {
    return null;
  }

  if (documentContent.type === 'json') {
    return {
      type: 'doc',
      content: documentContent.content,
    } as JSONContent;
  }

  return documentContent.content;
}

/** Extracts plain text preview from proposal content. */
export function getProposalContentPreview(
  documentContent?: DocumentContent,
): string | null {
  if (!documentContent) {
    return null;
  }

  if (documentContent.type === 'json') {
    try {
      const doc = {
        type: 'doc',
        content: documentContent.content as JSONContent[],
      };
      const text = generateText(doc, defaultViewerExtensions);
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  return getTextPreview({ content: documentContent.content, maxLines: 3 });
}
