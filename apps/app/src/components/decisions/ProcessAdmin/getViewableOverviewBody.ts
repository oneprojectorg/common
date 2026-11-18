import { sanitizeTiptapDoc } from '@op/common/client';
import type { JSONContent } from '@tiptap/core';

/**
 * The stored overview body, ready for the viewer, or null when it holds nothing
 * to show. A body the admin typed and then cleared is saved as a doc of empty
 * paragraphs, so it counts as empty. A JSON doc is sanitized, because one
 * unknown node type makes TipTap blank the whole doc.
 */
export function getViewableOverviewBody(
  body: string | JSONContent | undefined,
): string | JSONContent | null {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    return body.replace(/<p>\s*<\/p>/g, '').trim() ? body : null;
  }

  const doc = sanitizeTiptapDoc(body);
  const hasContent = (doc.content ?? []).some(
    (node) => node.type !== 'paragraph' || (node.content?.length ?? 0) > 0,
  );

  return hasContent ? doc : null;
}
