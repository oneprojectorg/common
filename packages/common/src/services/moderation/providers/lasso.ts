import type {
  ModerationProvider,
  ModerationProviderReference,
  ModerationScores,
} from '../types';
import { moderationFetch } from './moderationFetch';

const DEFAULT_API_URL = 'https://api.lassomoderation.com/api/v1';
// Lasso returns an allow/block verdict rather than per-category scores; a block
// maps to a decisive score that meets the summed gate threshold on its own.
const BLOCK_SCORE = 1;

/** Lasso's verdict for a piece of content. */
type LassoStatus = 'allowed' | 'flagged' | 'hidden';
/** Verdicts where Lasso's rules acted on the content (i.e. it's disallowed). */
const BLOCKING_STATUSES: readonly LassoStatus[] = ['flagged', 'hidden'];

interface LassoResult {
  status?: LassoStatus;
  actions?: Array<{ content?: { id?: string } }>;
  content?: { id?: string };
}

const post = async (
  url: string,
  apiToken: string,
  body: Record<string, unknown>,
): Promise<LassoResult> => {
  const response = await moderationFetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  return response.json();
};

// Minimal envelope Lasso's content endpoints require beyond the text itself.
const envelope = (content: string, itemId: string) => ({
  content_id: itemId,
  text: content,
  category: { id: 'content', name: 'content' },
  subcategory: { id: 'content', name: 'content' },
  user: { id: 'unknown' },
});

const referenceFrom = (result: LassoResult): ModerationProviderReference => {
  return {
    providerRecordId: result.actions?.[0]?.content?.id ?? result.content?.id,
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
    const blocked = result.status
      ? BLOCKING_STATUSES.includes(result.status)
      : false;
    const scores: ModerationScores = blocked ? { other: BLOCK_SCORE } : {};
    return scores;
  },

  submitForReview: async ({ itemId, content }) => {
    const result = await post(`${apiUrl}/content`, apiToken, {
      ...envelope(content, itemId),
    });
    return referenceFrom(result);
  },
});
