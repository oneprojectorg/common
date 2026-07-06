import type { TipTapFragmentResponse } from '@op/collab';
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

    // TEMP instrumentation (ONE-401): pinpoint which fragment sends
    // server-side HTML generation into a runaway (OOM/SIGKILL on prod). If the
    // process dies mid-render, the "before" line prints without a matching
    // "after" line, naming the culprit fragment. Remove once diagnosed.
    const inputNodeCount = fragment.content.length;
    const inputBytes = JSON.stringify(fragment.content).length;
    const startedAt = Date.now();
    const heapBeforeMb = Math.round(process.memoryUsage().heapUsed / 1_000_000);
    console.warn(
      `[ONE-401] generateProposalHtml begin fragment="${fragmentName}" nodes=${inputNodeCount} inputBytes=${inputBytes} heapMB=${heapBeforeMb}`,
    );

    try {
      const doc: JSONContent = {
        type: 'doc',
        content: fragment.content as JSONContent[],
      };

      result[fragmentName] = generateHTML(doc, serverExtensions);

      const heapAfterMb = Math.round(
        process.memoryUsage().heapUsed / 1_000_000,
      );
      console.warn(
        `[ONE-401] generateProposalHtml end fragment="${fragmentName}" outputBytes=${result[fragmentName].length} ms=${Date.now() - startedAt} heapMB=${heapAfterMb}`,
      );
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
