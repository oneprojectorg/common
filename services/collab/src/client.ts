import ky from 'ky';

/**
 * TipTap document content in JSON format
 * @see https://tiptap.dev/docs/collaboration/documents/rest-api
 */
export type TipTapDocument = {
  type: string;
  content?: unknown[];
};

type TipTapClientConfig = {
  appId: string;
  secret: string;
};

/**
 * Create a TipTap Cloud REST API client
 *
 * @see https://tiptap.dev/docs/collaboration/documents/rest-api
 */
export function createTipTapClient(config: TipTapClientConfig) {
  const api = ky.create({
    prefixUrl: `https://${config.appId}.collab.tiptap.cloud/api`,
    headers: { Authorization: config.secret },
    retry: { limit: 2, methods: ['get'] },
    timeout: 5000,
  });

  return {
    /**
     * Fetch a document by name
     * GET /api/documents/{docName}?format=json
     */
    getDocument: async (docName: string): Promise<TipTapDocument> => {
      return api
        .get(`documents/${encodeURIComponent(docName)}`, {
          searchParams: { format: 'json' },
        })
        .json<TipTapDocument>();
    },
  };
}
