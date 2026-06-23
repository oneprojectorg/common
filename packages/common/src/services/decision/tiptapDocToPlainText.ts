import type { JSONContent } from '@tiptap/core';

/**
 * Flatten a TipTap JSON doc to its plain text. Used as a graceful fallback when
 * the static renderer can't render a stored doc — e.g. an unregistered node type
 * throws during schema parse (`Node.fromJSON`). Degrading to plain text keeps the
 * content readable instead of crashing the whole render. Walks `text` leaves
 * depth-first and joins block-level nodes with newlines.
 *
 * Distinct from `extractProposalText`, which collects strings from a flat
 * proposalData record; this walks the nested TipTap node tree.
 */
export function tiptapDocToPlainText(
  doc: JSONContent | null | undefined,
): string {
  if (!doc) {
    return '';
  }

  const collectInline = (node: JSONContent, inline: string[]): void => {
    if (typeof node.text === 'string') {
      inline.push(node.text);
    }

    for (const child of node.content ?? []) {
      collectInline(child, inline);
    }
  };

  const blocks: string[] = [];
  for (const node of doc.content ?? []) {
    const inline: string[] = [];
    collectInline(node, inline);
    const text = inline.join('').trim();
    if (text) {
      blocks.push(text);
    }
  }

  return blocks.join('\n');
}
