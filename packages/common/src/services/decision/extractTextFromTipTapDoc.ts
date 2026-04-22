import { type JSONContent, generateText } from '@tiptap/core';

import { serverExtensions } from './tiptapExtensions';

/**
 * Extracts plain text from a TipTap JSON document (format=json) using
 * TipTap's `generateText` with the shared server extension list.
 *
 * Atom nodes like iframely carry their payload in attributes rather than
 * text children, so we register a text serializer that returns the `src`
 * URL — otherwise required-field validation would treat an embed-only
 * field as empty.
 */
export function extractTextFromTipTapDoc(doc: { content?: unknown[] }): string {
  if (!doc.content || doc.content.length === 0) {
    return '';
  }

  try {
    return generateText(
      { type: 'doc', content: doc.content as JSONContent[] },
      serverExtensions,
      {
        blockSeparator: '\n',
        textSerializers: {
          iframely: ({ node }) => {
            const src = node.attrs?.src;
            return typeof src === 'string' ? src : '';
          },
        },
      },
    ).trim();
  } catch (error) {
    console.warn('Failed to extract text from TipTap doc', {
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}
