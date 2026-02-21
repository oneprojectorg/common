import type { TipTapFragmentResponse } from '@op/collab';
import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';

import { serverExtensions } from './tiptapExtensions';

/**
 * Converts TipTap JSON fragments to HTML strings.
 *
 * All fragments are stored as valid ProseMirror content (paragraph-wrapped)
 * via `useCollaborativeFragment`, so every fragment — text fields, dropdowns,
 * money fields — can be processed through `generateHTML()`.
 *
 * Filtering by field type (e.g. excluding scalar values from card previews)
 * is the caller's responsibility via `x-format`.
 *
 * @param fragments - TipTap fragment response from the collaboration service
 * @returns Record mapping fragment name to HTML string
 */
export function generateProposalHtml(
  fragments: TipTapFragmentResponse,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [fragmentName, fragment] of Object.entries(fragments)) {
    if (!fragment.content || fragment.content.length === 0) {
      result[fragmentName] = '';
      continue;
    }

    try {
      const doc: JSONContent = {
        type: 'doc',
        content: fragment.content as JSONContent[],
      };

      result[fragmentName] = generateHTML(doc, serverExtensions);
    } catch (error) {
      console.warn('Failed to generate HTML for fragment', {
        fragmentName,
        error: error instanceof Error ? error.message : String(error),
      });
      result[fragmentName] = '';
    }
  }

  return result;
}
