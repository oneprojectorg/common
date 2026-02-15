import type { proposalEncoder } from '@op/api/encoders';
import { serverExtensions } from '@op/common/src/services/decision';
import { getTextPreview } from '@op/core';
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
    // Merge all fragment contents (excluding title, rendered separately) into a single doc
    const allContent: unknown[] = [];
    for (const [key, fragment] of Object.entries(documentContent.fragments)) {
      if (key === 'title' || !fragment?.content) {
        continue;
      }
      allContent.push(...fragment.content);
    }

    // Fall back to legacy `default` fragment if no keyed fragments matched
    if (allContent.length === 0) {
      const defaultFragment = documentContent.fragments.default;
      if (!defaultFragment?.content) {
        return null;
      }
      allContent.push(...defaultFragment.content);
    }

    if (allContent.length === 0) {
      return null;
    }

    return {
      type: 'doc',
      content: allContent,
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
    const content = getProposalContent(documentContent);

    if (!content || typeof content === 'string') {
      return null;
    }

    try {
      const text = generateText(content as JSONContent, serverExtensions);
      return text.trim();
    } catch {
      return null;
    }
  }

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}
