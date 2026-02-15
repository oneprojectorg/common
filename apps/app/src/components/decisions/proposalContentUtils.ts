import type { proposalEncoder } from '@op/api/encoders';
import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import { getTextPreview } from '@op/core';
import { defaultViewerExtensions } from '@op/ui/RichTextEditor';
import { type JSONContent, Node, generateText } from '@tiptap/core';
import type { z } from 'zod';

/**
 * Minimal iframely node extension for `generateText()`.
 *
 * The full IframelyExtension (with React node view) lives in the editor and
 * cannot be used here because `generateText()` only needs the ProseMirror
 * schema — no rendering. Without this registration, `generateText()` throws
 * on any doc containing an iframely embed, which causes the proposal listing
 * card to show "Content could not be loaded".
 */
const IframelyTextNode = Node.create({
  name: 'iframely',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
    };
  },
});

const generateTextExtensions = [...defaultViewerExtensions, IframelyTextNode];

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
      const text = generateText(content, generateTextExtensions);
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}
