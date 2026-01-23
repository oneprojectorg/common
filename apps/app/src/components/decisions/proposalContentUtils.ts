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
 *
 * @param documentContent - The proposal's documentContent field
 * @param fallbackDescription - Legacy description from proposalData to use as fallback
 */
export function getProposalContent(
  documentContent: DocumentContent | undefined | null,
  fallbackDescription?: string | null,
): Content | null {
  if (documentContent) {
    if (documentContent.type === 'json') {
      return {
        type: 'doc',
        content: documentContent.content,
      } as JSONContent;
    }
    if (documentContent.type === 'html') {
      return documentContent.content;
    }
  }

  // Fallback to legacy description
  if (fallbackDescription) {
    return fallbackDescription;
  }

  return null;
}

/**
 * Extracts plain text preview from proposal content (TipTap JSON or legacy HTML).
 *
 * @param documentContent - The proposal's documentContent field
 * @param fallbackDescription - Legacy description from proposalData to use as fallback
 * @param maxLines - Maximum number of lines for HTML preview (default: 3)
 */
export function getProposalContentPreview(
  documentContent: DocumentContent | undefined | null,
  fallbackDescription?: string | null,
  maxLines = 3,
): string | null {
  if (documentContent) {
    if (documentContent.type === 'json') {
      const doc = {
        type: 'doc',
        content: documentContent.content as JSONContent[],
      };
      const text = generateText(doc, defaultViewerExtensions);
      return text.trim() || null;
    }
    if (documentContent.type === 'html') {
      return getTextPreview({ content: documentContent.content, maxLines });
    }
  }

  // Fallback to legacy description
  if (fallbackDescription) {
    return getTextPreview({ content: fallbackDescription, maxLines });
  }

  return null;
}
