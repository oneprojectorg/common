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
    // process dies mid-render, the "begin" line prints without a matching
    // "end" line, naming the culprit fragment. We also dump the raw fragment
    // JSON (capped) so the exact structure can be reproduced locally without
    // another deploy, and report the full memory breakdown (heap vs
    // external/arrayBuffers) so we can tell where the memory actually goes.
    // Remove once diagnosed.
    const formatMem = () => {
      const m = process.memoryUsage();
      return `rssMB=${Math.round(m.rss / 1e6)} heapMB=${Math.round(m.heapUsed / 1e6)} extMB=${Math.round(m.external / 1e6)} abMB=${Math.round((m.arrayBuffers ?? 0) / 1e6)}`;
    };
    const inputJson = JSON.stringify(fragment.content);
    const startedAt = Date.now();
    console.warn(
      `[ONE-401] generateProposalHtml begin fragment="${fragmentName}" nodes=${fragment.content.length} inputBytes=${inputJson.length} ${formatMem()}`,
    );
    console.warn(
      `[ONE-401] fragment="${fragmentName}" json(capped20k)=${inputJson.slice(0, 20_000)}`,
    );

    try {
      const doc: JSONContent = {
        type: 'doc',
        content: fragment.content as JSONContent[],
      };

      result[fragmentName] = generateHTML(doc, serverExtensions);

      console.warn(
        `[ONE-401] generateProposalHtml end fragment="${fragmentName}" outputBytes=${result[fragmentName].length} ms=${Date.now() - startedAt} ${formatMem()}`,
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
