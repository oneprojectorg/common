import type {
  ModerationProvider,
  ModerationProviderReference,
  ModerationScores,
} from '../types';

const DEFAULT_API_URL = 'https://api.lassomoderation.com/api/v1';
const DASHBOARD_URL = 'https://app.lassomoderation.com';
const REQUEST_TIMEOUT_MS = 5_000;
// Lasso returns an allow/block verdict rather than per-category scores; a block
// maps to a decisive score that meets the summed gate threshold on its own.
const BLOCK_SCORE = 1;

interface LassoResult {
  status?: string;
  actions?: Array<{ content?: { id?: string } }>;
  content?: { id?: string };
}

const post = async (
  url: string,
  apiToken: string,
  body: Record<string, unknown>,
): Promise<LassoResult> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  return response.json();
};

// Minimal envelope Lasso's content endpoints require beyond the text itself.
const envelope = (content: string, subjectId: string) => ({
  content_id: subjectId,
  text: content,
  category: { id: 'content', name: 'content' },
  subcategory: { id: 'content', name: 'content' },
  user: { id: 'unknown' },
});

const referenceFrom = (result: LassoResult): ModerationProviderReference => {
  const id = result.actions?.[0]?.content?.id ?? result.content?.id;
  return {
    providerName: 'lasso',
    providerRecordId: id,
    providerUrl: id ? `${DASHBOARD_URL}/content/${id}` : undefined,
  };
};

/**
 * Lasso moderation adapter. A platform vendor: it ingests content under an id,
 * returns an allow/flag/hide verdict, and keeps a dashboard record — so it also
 * implements `submitForReview` for the async path. Key/URL never leak in errors.
 */
export const createLassoProvider = ({
  apiToken,
  apiUrl = DEFAULT_API_URL,
}: {
  apiToken: string;
  apiUrl?: string;
}): ModerationProvider => ({
  scoreText: async ({ content }) => {
    const result = await post(`${apiUrl}/content/sync`, apiToken, {
      ...envelope(content, crypto.randomUUID()),
    });
    const blocked = result.status === 'flagged' || result.status === 'hidden';
    const scores: ModerationScores = blocked ? { other: BLOCK_SCORE } : {};
    return scores;
  },

  submitForReview: async ({ subjectId, content }) => {
    const result = await post(`${apiUrl}/content`, apiToken, {
      ...envelope(content, subjectId),
    });
    return referenceFrom(result);
  },
});
