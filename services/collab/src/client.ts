import ky from 'ky';

/**
 * TipTap document content in JSON format
 * @see https://tiptap.dev/docs/collaboration/documents/rest-api
 */
export type TipTapDocument = {
  type: string;
  content?: unknown[];
};

/**
 * TipTap document response when fetching multiple named fragments.
 */
export type TipTapFragmentResponse = Record<string, TipTapDocument>;

type TipTapClientConfig = {
  appId: string;
  secret: string;
};

export type TipTapClient = ReturnType<typeof createTipTapClient>;

/**
 * Checks whether a payload looks like a single TipTap document.
 */
function isTipTapDocument(value: unknown): value is TipTapDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.type === 'string' &&
    (candidate.content === undefined || Array.isArray(candidate.content))
  );
}

/**
 * Create a TipTap Cloud REST API client
 *
 * @see https://tiptap.dev/docs/collaboration/documents/rest-api
 */
export function createTipTapClient(config: TipTapClientConfig) {
  const prefixUrl = `https://${config.appId}.collab.tiptap.cloud/api`;

  const api = ky.create({
    prefixUrl,
    headers: { Authorization: config.secret },
    retry: { limit: 2, methods: ['get'] },
    timeout: 3_000,
  });

  return {
    /**
     * Fetch a document by name
     * GET /api/documents/{docName}?format=json
     */
    getDocument: async (docName: string): Promise<TipTapDocument> => {
      return api
        .get<TipTapDocument>(`documents/${encodeURIComponent(docName)}`, {
          searchParams: { format: 'json' },
        })
        .json();
    },

    /**
     * Fetch specific named fragments from a document.
     * GET /api/documents/{docName}?format=json&fragment=X&fragment=Y
     */
    getDocumentFragments: async (
      docName: string,
      fragments: string[],
    ): Promise<TipTapFragmentResponse> => {
      const params = new URLSearchParams({ format: 'json' });

      for (const fragment of fragments) {
        params.append('fragment', fragment);
      }

      const response = await api
        .get<TipTapFragmentResponse>(
          `documents/${encodeURIComponent(docName)}`,
          {
            searchParams: params,
          },
        )
        .json();

      if (isTipTapDocument(response)) {
        const fragmentName = fragments[0] ?? 'default';

        return { [fragmentName]: response };
      }

      return response;
    },
  };
}
