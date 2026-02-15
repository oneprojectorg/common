import type { proposalEncoder } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { defaultViewerExtensions } from '@op/ui/RichTextEditor';
import { type JSONContent, Node, generateText } from '@tiptap/core';
import type { Content } from '@tiptap/react';
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
      const text = generateText(
        content as JSONContent,
        generateTextExtensions,
      );
      return text.trim();
    } catch {
      return null;
    }
  }

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}
