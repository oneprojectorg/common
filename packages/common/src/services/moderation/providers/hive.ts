import type {
  ModerationCategory,
  ModerationProvider,
  ModerationScores,
} from '../types';
import { moderationFetch } from './moderationFetch';

const DEFAULT_URL = 'https://api.thehive.ai/api/v2/task/sync';
// Hive returns integer severity 0-3 per class; normalize onto our 0-1 scale.
const HIVE_MAX_SCORE = 3;

// Hive's class names mapped onto our moderation categories.
const CLASS_MAP: Record<string, ModerationCategory> = {
  sexual: 'sexual',
  hate: 'hate',
  violence: 'violence',
  bullying: 'harassment',
};

interface HiveClass {
  class?: string;
  score?: unknown;
}

const normalizeHiveScores = (data: unknown): ModerationScores => {
  const output = (
    data as { response?: { output?: Array<{ classes?: HiveClass[] }> } }
  )?.response?.output;
  const classes = Array.isArray(output) ? output[0]?.classes : undefined;
  if (!Array.isArray(classes)) {
    return {};
  }

  const scores: ModerationScores = {};
  for (const entry of classes) {
    const category = entry.class ? CLASS_MAP[entry.class] : undefined;
    const raw = entry.score;
    if (!category || typeof raw !== 'number' || !Number.isFinite(raw)) {
      continue;
    }
    const normalized = raw / HIVE_MAX_SCORE;
    // Keep the strongest signal if multiple Hive classes map to one category.
    scores[category] = Math.max(scores[category] ?? 0, normalized);
  }
  return scores;
};

/**
 * Hive text-moderation adapter. A pure classifier: it scores text but keeps no
 * per-item record, so it exposes no `submitForReview`. Vendor specifics (URL,
 * `Token` auth, 0-3 score scale) stay confined here, and the key/URL never
 * appear in thrown errors.
 */
export const createHiveProvider = ({
  apiKey,
  apiUrl = DEFAULT_URL,
}: {
  apiKey: string;
  apiUrl?: string;
}): ModerationProvider => ({
  scoreText: async ({ content }) => {
    const response = await moderationFetch(apiUrl, {
      method: 'POST',
      headers: {
        authorization: `Token ${apiKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ text_data: content }),
    });

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    return normalizeHiveScores(await response.json());
  },
});
