/**
 * Mock TipTap client for testing (vitest + e2e).
 *
 * - **Vitest**: seed per-doc responses via `mockCollab.setDocResponse()` or
 *   per-fragment responses via `mockCollab.setDocFragmentResponses()`.
 * - **E2E**: webpack aliases `@op/collab` here; `test-proposal-doc` is pre-seeded
 *   with fixture content. Unseeded docs return 404.
 *
 * @example
 * import { mockCollab } from '@op/collab/testing';
 *
 * // Seed per-fragment JSON (matches real TipTap Cloud response shape):
 * mockCollab.setDocFragmentResponses('doc-id', {
 *   title: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'My Title' }] }] },
 *   category: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option A' }] }] },
 * });
 *
 * // Or seed a single doc that gets returned for every requested fragment:
 * mockCollab.setDocResponse('doc-id', { type: 'doc', content: [...] });
 */
import type { TipTapDocument, TipTapFragmentResponse } from '../src/client';

// Re-export types so `import { type X } from '@op/collab'` resolves when aliased here.
export type {
  TipTapDocument,
  TipTapFragmentResponse,
  TipTapClient,
} from '../src/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a `TipTapDocument` containing a single paragraph with the given
 * text. Matches the shape TipTap Cloud produces for fragments written via
 * `useCollaborativeFragment` (paragraph-wrapped `Y.XmlElement`).
 *
 * Use this when seeding dropdown/money/category fragment values in tests.
 *
 * @example
 * mockCollab.setDocFragmentResponses('doc-id', {
 *   category: textFragment('Option A'),
 *   budget: textFragment('{"amount":5000,"currency":"USD"}'),
 * });
 */
export function textFragment(text: string): TipTapDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

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
    {
      type: 'iframely',
      attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    },
  ],
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Per-doc whole-document responses (legacy — returns same doc for every fragment).
const docResponses = new Map<string, () => Promise<unknown>>();

// Per-doc, per-fragment JSON responses (matches real TipTap Cloud shape).
const docFragmentJsonResponses = new Map<string, TipTapFragmentResponse>();

// Per-doc, per-fragment text responses for format='text' support.
const docFragmentTextResponses = new Map<string, Record<string, string>>();

// Pre-seed the well-known e2e doc ID so the Next.js server (separate process)
// returns fixture content without needing cross-process seeding.
docResponses.set('test-proposal-doc', () =>
  Promise.resolve(E2E_FIXTURE_CONTENT),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const mockCollab = {
  /**
   * Set a whole-document mock response for a specific document ID.
   * When `getDocumentFragments` is called, every requested fragment key will
   * receive this same document. Prefer `setDocFragmentResponses` for tests
   * that need distinct per-fragment content.
   */
  setDocResponse: (docId: string, data: unknown) => {
    docResponses.set(docId, () => Promise.resolve(data));
  },

  /**
   * Set per-fragment JSON responses for a document.
   * This is the most realistic seeding method — it matches the shape returned
   * by TipTap Cloud's REST API when fetching named fragments.
   *
   * Fragments not present in the map will be returned as `{ type: 'doc', content: [] }`.
   */
  setDocFragmentResponses: (
    docId: string,
    fragments: TipTapFragmentResponse,
  ) => {
    docFragmentJsonResponses.set(docId, fragments);
  },

  /**
   * Set per-fragment text responses for a document.
   * Used when `getDocumentFragments` is called with `format='text'`.
   */
  setDocFragments: (docId: string, fragments: Record<string, string>) => {
    docFragmentTextResponses.set(docId, fragments);
  },

  /** Set a mock error response for a specific document ID. */
  setDocError: (docId: string, error: Error) => {
    docResponses.set(docId, () => Promise.reject(error));
  },
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Resolve a document request: seeded response or 404. */
function resolveDoc(docName: string): Promise<unknown> {
  const handler = docResponses.get(docName);
  if (handler) {
    return handler();
  }
  return Promise.reject(new Error('404 Not Found'));
}

// ---------------------------------------------------------------------------
// Mock client
// ---------------------------------------------------------------------------

/** Mock createTipTapClient. Returns seeded per-doc responses or 404. */
export function createTipTapClient(_config?: unknown) {
  return {
    getDocument: (docName: string) => resolveDoc(docName),

    getDocumentFragments: async <F extends 'json' | 'text' = 'json'>(
      docName: string,
      fragments: string[],
      format?: F,
    ): Promise<
      F extends 'text' ? Record<string, string> : TipTapFragmentResponse
    > => {
      type R = F extends 'text'
        ? Record<string, string>
        : TipTapFragmentResponse;

      // --- format='text' path ---
      if ((format ?? 'json') === 'text') {
        const seeded = docFragmentTextResponses.get(docName) ?? {};
        return Object.fromEntries(
          fragments.map((f) => [f, seeded[f] ?? '']),
        ) as R;
      }

      // --- format='json' path ---

      // 1. Per-fragment JSON responses (preferred — most realistic)
      const perFragment = docFragmentJsonResponses.get(docName);
      if (perFragment) {
        const emptyDoc: TipTapDocument = { type: 'doc', content: [] };
        return Object.fromEntries(
          fragments.map((f) => [f, perFragment[f] ?? emptyDoc]),
        ) as R;
      }

      // 2. Whole-document fallback — every fragment gets the same doc
      const doc = await resolveDoc(docName);
      return Object.fromEntries(
        fragments.map((fragment) => [fragment, doc]),
      ) as R;
    },
  };
}
