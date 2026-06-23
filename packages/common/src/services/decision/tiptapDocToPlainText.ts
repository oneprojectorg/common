import type { JSONContent } from '@tiptap/core';

/**
 * Flatten a TipTap JSON doc to plain-text blocks (newline-joined). Used as a
 * graceful fallback when the static renderer can't render a stored doc — e.g. an
 * unregistered node type throws during schema parse (`Node.fromJSON`). Degrading
 * to plain text keeps the content readable instead of crashing the whole render;
 * the caller renders one element per line.
 *
 * Each textblock (paragraph, heading, summary, …) becomes one block. Container
 * nodes (details, lists, blockquote, and unknown wrappers) are walked so their
 * inner blocks split out onto their own lines instead of collapsing into one run
 * (e.g. a details summary and its body land on separate lines).
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

  const textOf = (node: JSONContent): string => {
    if (typeof node.text === 'string') {
      return node.text;
    }

    return (node.content ?? []).map(textOf).join('');
  };

  // A textblock holds only inline content (text leaves / atoms like hardBreak);
  // a container holds other block nodes. Splitting on containers is what keeps a
  // details summary and its body — or list items — on separate lines.
  const isTextblock = (node: JSONContent): boolean =>
    Array.isArray(node.content) &&
    node.content.length > 0 &&
    node.content.every(
      (child) => typeof child.text === 'string' || !child.content,
    );

  const blocks: string[] = [];
  const visit = (node: JSONContent): void => {
    if (isTextblock(node)) {
      const text = textOf(node).trim();
      if (text) {
        blocks.push(text);
      }

      return;
    }

    for (const child of node.content ?? []) {
      if (typeof child.text === 'string') {
        // Stray inline text directly under a container (rare) — keep it.
        const text = child.text.trim();
        if (text) {
          blocks.push(text);
        }
      } else {
        visit(child);
      }
    }
  };

  for (const node of doc.content ?? []) {
    visit(node);
  }

  return blocks.join('\n');
}
