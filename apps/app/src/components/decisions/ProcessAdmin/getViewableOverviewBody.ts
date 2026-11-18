import { sanitizeTiptapDoc } from '@op/common/client';
import type { JSONContent } from '@tiptap/core';

/**
 * The stored overview body, ready for the viewer, or null when it holds nothing
 * to show. A body the admin typed and then cleared is saved as a doc of empty
 * blocks, so it counts as empty. A JSON doc is sanitized, because one unknown
 * node type makes TipTap blank the whole doc.
 */
export function getViewableOverviewBody(
  body: string | JSONContent | undefined,
): string | JSONContent | null {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    return body.replace(EMPTY_HTML_PARAGRAPH, '').trim() ? body : null;
  }

  const doc = sanitizeTiptapDoc(body);

  return (doc.content ?? []).some(hasVisibleContent) ? doc : null;
}

const EMPTY_HTML_PARAGRAPH = /<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/g;

const BLOCKS_THAT_SHOW_ONLY_THEIR_CHILDREN = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
]);

function hasVisibleContent(node: JSONContent): boolean {
  if (node.type === 'text') {
    return Boolean(node.text?.trim());
  }

  if (node.content?.length) {
    return node.content.some(hasVisibleContent);
  }

  return !BLOCKS_THAT_SHOW_ONLY_THEIR_CHILDREN.has(node.type ?? '');
}
