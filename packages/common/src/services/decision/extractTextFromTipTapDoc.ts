/** Minimal TipTap JSON node shape returned by format=json */
type TipTapNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

function isTipTapNode(value: unknown): value is TipTapNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/**
 * Extracts plain text from a TipTap JSON document (format=json),
 * mirroring `getBlockText` in useProposalValidation but operating on
 * the REST API JSON format instead of Yjs XmlElements.
 *
 * Handles iframely atom nodes by returning their src URL so required-field
 * validation treats them as non-empty.
 */
export function extractTextFromTipTapDoc(doc: { content?: unknown[] }): string {
  function nodeText(node: TipTapNode): string {
    if (node.type === 'iframely') {
      const src = node.attrs?.src;
      return typeof src === 'string' ? src : '';
    }
    if (node.type === 'text') {
      return node.text ?? '';
    }
    return (node.content ?? []).map(nodeText).join('');
  }

  const blocks = (doc.content ?? []).filter(isTipTapNode);
  return blocks
    .map((block) => nodeText(block))
    .join('\n')
    .trim();
}
