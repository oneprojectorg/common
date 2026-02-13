/**
 * Mock TipTap client for testing (vitest + e2e).
 *
 * - **Vitest**: seed per-doc responses via `mockCollab.setDocResponse()`
 * - **E2E**: webpack aliases `@op/collab` here; `test-proposal-doc` is pre-seeded
 *   with fixture content. Unseeded docs return 404.
 *
 * @example
 * import { mockCollab } from '@op/collab/testing';
 *
 * it('fetches document', () => {
 *   mockCollab.setDocResponse('doc-id', { type: 'doc', content: [] });
 *   // ... test code
 * });
 */
import type { TipTapDocument, TipTapFragmentResponse } from '../src/client';

// Re-export types so `import { type X } from '@op/collab'` resolves when aliased here.
export type {
  TipTapDocument,
  TipTapFragmentResponse,
  TipTapClient,
} from '../src/client';

/** Fixture content for `test-proposal-doc` (used by e2e tests). */
const E2E_FIXTURE_CONTENT: TipTapDocument = {
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

// Per-doc responses — concurrent-safe.
const docResponses = new Map<string, () => Promise<unknown>>();

// Pre-seed the well-known e2e doc ID so the Next.js server (separate process)
// returns fixture content without needing cross-process seeding.
docResponses.set('test-proposal-doc', () =>
  Promise.resolve(E2E_FIXTURE_CONTENT),
);

export const mockCollab = {
  /** Set a mock response for a specific document ID. */
  setDocResponse: (docId: string, data: unknown) => {
    docResponses.set(docId, () => Promise.resolve(data));
  },

  /** Set a mock error response for a specific document ID. */
  setDocError: (docId: string, error: Error) => {
    docResponses.set(docId, () => Promise.reject(error));
  },
};

/** Resolve a document request: seeded response or 404. */
function resolveDoc(docName: string): Promise<unknown> {
  const handler = docResponses.get(docName);
  if (handler) {
    return handler();
  }
  return Promise.reject(new Error('404 Not Found'));
}

/** Mock createTipTapClient. Returns seeded per-doc responses or 404. */
export function createTipTapClient(_config?: unknown) {
  return {
    getDocument: (docName: string) => resolveDoc(docName),

    getDocumentFragments: async (docName: string, fragments: string[]) => {
      const doc = await resolveDoc(docName);

      return Object.fromEntries(
        fragments.map((fragment) => [fragment, doc]),
      ) as TipTapFragmentResponse;
    },
  };
}
