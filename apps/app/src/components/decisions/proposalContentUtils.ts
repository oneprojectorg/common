import type { proposalEncoder } from '@op/api/encoders';
import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import { getTextPreview } from '@op/core';
import { defaultViewerExtensions } from '@op/ui/RichTextEditor';
import { type JSONContent, generateText } from '@tiptap/core';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;
type DocumentContent = NonNullable<Proposal['documentContent']>;

/**
 * Extracts a plain-text preview from proposal document content.
 *
 * System fields (title, budget, category) are excluded because they are
 * rendered separately in the card header and their TipTap fragments contain
 * double-nested arrays rather than standard TipTap nodes, which crashes
 * `generateText()`.
 */
export function getProposalContentPreview(
  documentContent?: DocumentContent,
): string | null {
  if (!documentContent) {
    return null;
  }

  if (documentContent.type === 'json') {
    const { fragments } = documentContent;
    const allContent: unknown[] = [];

    for (const [key, fragment] of Object.entries(fragments)) {
      if (SYSTEM_FIELD_KEYS.has(key) || !fragment?.content) {
        continue;
      }
      allContent.push(...fragment.content);
    }

    // Fall back to legacy `default` fragment
    if (allContent.length === 0) {
      const defaultFragment = fragments.default;
      if (defaultFragment?.content) {
        allContent.push(...defaultFragment.content);
      }
    }

    if (allContent.length === 0) {
      return null;
    }

    const content = { type: 'doc', content: allContent } as JSONContent;

    try {
      return generateText(content, defaultViewerExtensions).trim() || null;
    } catch {
      return null;
    }
  }

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}
