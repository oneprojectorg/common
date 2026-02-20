/**
 * Utilities for handling TipTap Cloud fragment content.
 *
 * Fragments stored via `useCollaborativeFragment` (dropdown, budget, category)
 * write raw `Y.XmlText` into the Yjs doc. TipTap Cloud serialises these in
 * two known shapes that differ from standard TipTap editor content:
 *
 * - Bare text nodes: `{ type: "text", text: "..." }`
 * - Double-nested arrays: `[[{ type: "text", text: "..." }]]`
 *
 * Neither is a valid direct child of a TipTap `doc` node, so passing them to
 * `generateHTML()` or `generateText()` crashes ProseMirror.
 */

/**
 * Returns true when a content node is NOT a valid TipTap block node.
 */
function isNonBlockNode(node: unknown): boolean {
  if (Array.isArray(node)) {
    return true;
  }
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as Record<string, unknown>).type === 'text'
  );
}

/**
 * Checks whether a fragment's content array contains only non-block nodes
 * (raw text or nested arrays from `useCollaborativeFragment`), meaning it
 * cannot be processed by TipTap's `generateHTML()` / `generateText()`.
 */
export function isRawValueFragment(content: unknown[]): boolean {
  return content.every(isNonBlockNode);
}

/**
 * Extracts plain text from raw fragment content produced by
 * `useCollaborativeFragment`-backed fields (dropdown, budget, etc.).
 *
 * Handles both bare text nodes `{ type: "text", text: "..." }` and
 * double-nested arrays `[[{ type: "text", text: "..." }]]`.
 */
export function extractFragmentRawText(content: unknown[]): string {
  return content
    .flatMap((node) => {
      if (Array.isArray(node)) {
        return node.flat(Infinity);
      }
      return [node];
    })
    .map((node) => {
      if (
        typeof node === 'object' &&
        node !== null &&
        typeof (node as Record<string, unknown>).text === 'string'
      ) {
        return (node as Record<string, string>).text;
      }
      return '';
    })
    .join('');
}
