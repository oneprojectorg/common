import type { proposalEncoder } from '@op/api/encoders';
import {
  SYSTEM_FIELD_KEYS,
  isRawValueFragment,
  serverExtensions,
} from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;
type DocumentContent = NonNullable<Proposal['documentContent']>;

/**
 * Extracts a plain-text preview from proposal document content.
 *
 * System fields (title, budget, category) are excluded because they are
 * rendered separately in the card header. Dynamic fields that store raw
 * `Y.XmlText` (dropdowns, money fields) are also filtered out because
 * their bare `text` nodes crash `generateText()`.
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

      // Skip fragments whose content is bare inline text nodes (dropdown,
      // budget fields stored via useCollaborativeFragment). These are not
      // valid TipTap doc children and would crash generateText().
      const hasOnlyRawText = isRawValueFragment(fragment.content);
      if (hasOnlyRawText) {
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
