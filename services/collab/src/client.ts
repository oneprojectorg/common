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

export interface TipTapVersion {
  version: number;
  createdAt: string;
  name?: string;
  meta?: Record<string, unknown>;
}

export interface TipTapVersionCreateInput {
  name?: string;
  meta?: Record<string, unknown>;
}

type TipTapClientConfig = {
  appId: string;
  secret: string;
};

export type TipTapClient = ReturnType<typeof createTipTapClient>;

export function getTipTapClient(): TipTapClient {
  const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
  const secret = process.env.TIPTAP_SECRET;

  if (!appId || !secret) {
    throw new Error('TipTap credentials not configured');
  }

  return createTipTapClient({ appId, secret });
}

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
      options?: { format?: F; version?: number },
    ): Promise<
      F extends 'text' ? Record<string, string> : TipTapFragmentResponse
    > => {
      type R = F extends 'text'
        ? Record<string, string>
        : TipTapFragmentResponse;
      const fmt = options?.format ?? 'json';
      const version = options?.version;
      const docPath = `documents/${encodeURIComponent(docName)}`;

      if (fmt === 'text') {
        // TipTap concatenates all fragment text into a single string when
        // multiple fragments are requested with format=text.  Fetch each
        // fragment individually so we get per-fragment text values.
        const entries = await Promise.all(
          fragments.map(async (fragment) => {
            const text = await api
              .get(docPath, {
                searchParams: {
                  format: 'text',
                  fragment,
                  ...(version !== undefined ? { version } : {}),
                },
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
      if (version !== undefined) {
        params.set('version', String(version));
      }

      const response = await api.get(docPath, { searchParams: params }).json();

      if (isTipTapDocument(response)) {
        const fragmentName = fragments[0] ?? 'default';
        return { [fragmentName]: response } as R;
      }

      return response as R;
    },

    /**
     * Fetch the saved versions for a document.
     */
    listVersions: async (docName: string): Promise<TipTapVersion[]> => {
      return api
        .get<
          TipTapVersion[]
        >(`documents/${encodeURIComponent(docName)}/versions`)
        .json();
    },

    /**
     * Return the highest version number for a document, or `null` when
     * no versions exist yet.
     */
    getLatestVersionId: async (docName: string): Promise<number | null> => {
      const versions = await api
        .get<
          TipTapVersion[]
        >(`documents/${encodeURIComponent(docName)}/versions`)
        .json();

      if (versions.length === 0) {
        return null;
      }

      return Math.max(...versions.map((v) => v.version));
    },

    /**
     * Create a new named version snapshot for a document.
     * The TipTap REST API returns an empty body on create, so we
     * follow up with a version list to resolve the created version.
     * POST /api/documents/{docName}/versions
     */
    createVersion: async (
      docName: string,
      input?: TipTapVersionCreateInput,
    ): Promise<TipTapVersion | null> => {
      const payload = input?.name || input?.meta ? input : undefined;

      await api.post(`documents/${encodeURIComponent(docName)}/versions`, {
        json: payload,
      });

      const versions = await api
        .get<
          TipTapVersion[]
        >(`documents/${encodeURIComponent(docName)}/versions`)
        .json();

      if (versions.length === 0) {
        return null;
      }

      return versions.reduce((latest, v) =>
        v.version > latest.version ? v : latest,
      );
    },
  };
}
