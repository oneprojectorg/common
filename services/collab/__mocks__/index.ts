/**
 * Mock TipTap client for testing.
 *
 * Provides a concurrent-safe mock that allows tests to configure
 * responses per document ID without interfering with parallel tests.
 *
 * @example
 * import { mockCollab } from '@op/collab/testing';
 *
 * it('fetches document', () => {
 *   mockCollab.setDocResponse('doc-id', { type: 'doc', content: [] });
 *   // ... test code
 * });
 */

// Mock TipTap document responses by docId - concurrent-safe
const docResponses = new Map<string, () => Promise<unknown>>();

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

/**
 * Mock implementation of createTipTapClient.
 * Returns a client that uses the configured docResponses map.
 */
export function createTipTapClient() {
  return {
    getDocument: (docName: string) => {
      const handler = docResponses.get(docName);
      if (handler) {
        return handler();
      }
      return Promise.reject(new Error('404 Not Found'));
    },
  };
}
