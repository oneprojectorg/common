/**
 * E2E mock for @op/collab.
 *
 * Replaces the real TipTap client at the webpack level (via next.config alias)
 * so the Next.js server never makes HTTP calls to TipTap Cloud during e2e tests.
 *
 * Unlike the vitest mock (./index.ts) which requires per-test seeding,
 * this returns fixture content for ANY document ID — matching the e2e
 * pattern where we don't control the mock from the Playwright process.
 */
import type { TipTapDocument, TipTapFragmentResponse } from '../src/client';

// Re-export types so `import { type X } from '@op/collab'` resolves when aliased here.
export type {
  TipTapDocument,
  TipTapFragmentResponse,
  TipTapClient,
} from '../src/client';

/** Well-known fixture content used across e2e tests. */
const FIXTURE_CONTENT: TipTapDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Bold text' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic text' },
        { type: 'text', text: ' and ' },
        {
          type: 'text',
          marks: [{ type: 'underline' }],
          text: 'underlined text',
        },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'First item' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Second item' }],
            },
          ],
        },
      ],
    },
    {
      type: 'iframely',
      attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    },
    { type: 'horizontalRule' },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: { href: 'https://example.com', target: '_blank' },
            },
          ],
          text: 'Example link',
        },
      ],
    },
  ],
};

/**
 * Mock createTipTapClient that returns fixture content for any document.
 * Unknown doc IDs (containing "nonexistent") return 404 to test error handling.
 */
export function createTipTapClient(_config?: unknown) {
  console.log('[e2e-mock] createTipTapClient called');
  return {
    getDocument: async (docName: string): Promise<TipTapDocument> => {
      console.log(`[e2e-mock] getDocument("${docName}")`);
      if (docName.includes('nonexistent')) {
        throw new Error('404 Not Found');
      }
      return FIXTURE_CONTENT;
    },

    getDocumentFragments: async (
      docName: string,
      fragments: string[],
    ): Promise<TipTapFragmentResponse> => {
      console.log(
        `[e2e-mock] getDocumentFragments("${docName}", ${JSON.stringify(fragments)})`,
      );
      if (docName.includes('nonexistent')) {
        throw new Error('404 Not Found');
      }

      return Object.fromEntries(
        fragments.map((f) => [f, FIXTURE_CONTENT]),
      ) as TipTapFragmentResponse;
    },
  };
}
