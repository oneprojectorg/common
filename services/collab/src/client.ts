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
 * TipTap document response when fetching multiple named fragments in JSON format.
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
  const api = ky.create({
    prefixUrl: `https://${config.appId}.collab.tiptap.cloud/api`,
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
     *
     * - `format='json'` (default): returns `Record<string, TipTapDocument>`
     * - `format='text'`: returns `Record<string, string>` (plain-text per fragment)
     *
     * @see https://tiptap.dev/docs/collaboration/documents/rest-api
     */
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
      const fmt = format ?? 'json';
      const docPath = `documents/${encodeURIComponent(docName)}`;

      if (fmt === 'text') {
        // TipTap concatenates all fragment text into a single string when
        // multiple fragments are requested with format=text.  Fetch each
        // fragment individually so we get per-fragment text values.
        const entries = await Promise.all(
          fragments.map(async (fragment) => {
            const text = await api
              .get(docPath, {
                searchParams: { format: 'text', fragment },
              })
              .text();
            return [fragment, text.trim()] as const;
          }),
        );
        return Object.fromEntries(entries) as R;
      }

      const params = new URLSearchParams({ format: fmt });
      for (const fragment of fragments) {
        params.append('fragment', fragment);
      }

      const response = await api.get(docPath, { searchParams: params }).json();

      if (isTipTapDocument(response)) {
        const fragmentName = fragments[0] ?? 'default';
        return { [fragmentName]: response } as R;
      }

      return response as R;
    },
  };
}
