import type { TipTapFragmentResponse } from '@op/collab';
import { logger } from '@op/logging';
import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';

import { serverExtensions } from './tiptapExtensions';

/**
 * Converts TipTap JSON fragments to HTML strings.
 *
 * The source data is our own JSON from TipTap Cloud — not user-supplied HTML — so
 * the output is deterministic and does not require sanitization.
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
      logger.error('Failed to generate HTML for fragment', {
        fragmentName,
        error,
      });
      result[fragmentName] = '';
    }
  }

  return result;
}
