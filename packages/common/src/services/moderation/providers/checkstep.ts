import type {
  ModerationCategory,
  ModerationProvider,
  ModerationProviderReference,
  ModerationScores,
} from '../types';
import { moderationFetch } from './moderationFetch';

const DEFAULT_API_URL = 'https://api.checkstep.com/api/v2';

// Checkstep policy codes mapped onto our categories; anything unmapped is `other`.
const POLICY_MAP: Record<string, ModerationCategory> = {
  HTE: 'hate',
  VIO: 'violence',
  SEX: 'sexual',
  HRS: 'harassment',
  PRF: 'profanity',
};

// Checkstep severity buckets mapped onto our 0-1 scale.
const SEVERITY_SCORE: Record<string, number> = {
  low: 0.3,
  medium: 0.6,
  high: 1,
};

interface CheckstepViolation {
  policy?: string;
  severity?: string;
}

const post = async (
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ violations?: CheckstepViolation[]; id?: string }> => {
  const response = await moderationFetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  return response.json();
};

const contentBody = (content: string, itemId: string) => ({
  id: itemId,
  fields: [{ id: 'text', type: 'text', src: content }],
});

const scoresFromViolations = (
  violations: CheckstepViolation[] | undefined,
): ModerationScores => {
  if (!Array.isArray(violations)) {
    return {};
  }
  const scores: ModerationScores = {};
  for (const violation of violations) {
    const category: ModerationCategory =
      (violation.policy ? POLICY_MAP[violation.policy] : undefined) ?? 'other';
    const score = violation.severity
      ? (SEVERITY_SCORE[violation.severity] ?? 0.5)
      : 0.5;
    scores[category] = Math.max(scores[category] ?? 0, score);
  }
  return scores;
};

/**
 * Checkstep moderation adapter. A platform vendor with policy-based violations,
 * a dashboard, and native appeals — implements `submitForReview` for the async
 * path. Key/URL never leak in errors.
 */
export const createCheckstepProvider = ({
  apiKey,
  apiUrl = DEFAULT_API_URL,
}: {
  apiKey: string;
  apiUrl?: string;
}): ModerationProvider => ({
  scoreText: async ({ content }) => {
    const result = await post(`${apiUrl}/content/sync`, apiKey, {
      ...contentBody(content, crypto.randomUUID()),
    });
    return scoresFromViolations(result.violations);
  },

  submitForReview: async ({ itemId, content }) => {
    const result = await post(`${apiUrl}/content`, apiKey, {
      ...contentBody(content, itemId),
    });
    const reference: ModerationProviderReference = {
      providerRecordId: result.id ?? itemId,
    };
    return reference;
  },
});
