import type { JSONContent } from '@tiptap/core';

/**
 * Whether the stored overview body holds anything to show. A body the admin
 * typed and then cleared is saved as a doc of empty blocks, so it counts as
 * empty. `RichTextRenderer` sanitizes the doc itself.
 */
export function hasViewableOverviewBody(
  body: string | JSONContent | undefined,
): body is string | JSONContent {
  if (!body) {
    return false;
  }

  if (typeof body === 'string') {
    return body.replace(EMPTY_HTML_PARAGRAPH, '').trim() !== '';
  }

  return (body.content ?? []).some(hasVisibleContent);
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
