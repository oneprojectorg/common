import type { proposalEncoder } from '@op/api/encoders';
import {
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  type XFormat,
  serverExtensions,
} from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;
type DocumentContent = NonNullable<Proposal['documentContent']>;

/** `x-format` values that represent rich-text editor content suitable for preview. */
const TEXT_FORMATS = new Set<XFormat>(['short-text', 'long-text']);

/**
 * Extracts a plain-text preview from proposal document content.
 *
 * Uses the proposal template's `x-format` to determine which fragments
 * contain text content. System fields (title, budget, category) and
 * scalar-value fields (dropdown, money) are excluded — only `short-text`
 * and `long-text` fragments are included in the preview.
 *
 * @param documentContent - The document content from the proposal
 * @param proposalTemplate - The proposal template schema (carries `x-format` per field)
 */
export function getProposalContentPreview(
  documentContent: DocumentContent | undefined,
  proposalTemplate: ProposalTemplateSchema | undefined,
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

      // Only include text fields in the preview. Scalar value fields
      // (dropdown, money) are rendered by their own card components.
      const format = proposalTemplate?.properties?.[key]?.['x-format'];
      if (format && !TEXT_FORMATS.has(format)) {
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
      // Empty doc (e.g. unedited draft) — render nothing, not an error.
      return '';
    }

    const content = { type: 'doc', content: allContent } as JSONContent;

    try {
      const text = generateText(content, serverExtensions);
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}
