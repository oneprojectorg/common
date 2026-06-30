import type { JSONContent } from '@tiptap/core';

/**
 * Extract a fragment's raw text from its TipTap JSON document, byte-for-byte
 * identical to the client-side `getFragmentPlainText` that reads the
 * Y.XmlFragment directly.
 *
 * The two MUST agree: client validation reads from Yjs and server validation
 * reads via the TipTap REST API. AJV's `oneOf` keyword is strict, so any
 * whitespace drift between the two paths surfaces as "X is invalid" for
 * dropdown values whose schema const has trailing whitespace.
 *
 * Distinct from `tiptapDocToPlainText`, which trims each block for
 * rendering/moderation; this preserves whitespace verbatim.
 *
 * Note: TipTap's own `format=text` REST endpoint applies a different
 * ProseMirror serialization that does NOT round-trip dropdown consts
 * (see ONE-289), so the validator fetches JSON and uses this instead.
 */
export function getFragmentTextFromTipTapDoc(
  doc: JSONContent | null | undefined,
): string {
  if (!doc?.content) {
    return '';
  }

  return doc.content.map(getBlockText).join('\n');
}

function getBlockText(node: JSONContent): string {
  if (!node.content) {
    return '';
  }

  return node.content
    .map((child) =>
      typeof child.text === 'string' ? child.text : getBlockText(child),
    )
    .join('');
}
