import type {
  ModerationCategory,
  ModerationProvider,
  ModerationScores,
} from '../types';
import { SYNC_GATE_FETCH, moderationFetch } from './moderationFetch';

const DEFAULT_URL = 'https://api.thehive.ai/api/v2/task/sync';
// Hive returns integer severity 0-3 per class; normalize onto our 0-1 scale.
const HIVE_MAX_SCORE = 3;
// Hive's sync text endpoint caps submissions at 1024 chars and asks callers to
// split longer text across submissions, so we chunk and score each piece.
const HIVE_MAX_TEXT_LENGTH = 1024;

// Hive's full set of text-moderation classes mapped onto our categories. Every
// class Hive can return is mapped so nothing disallowed is silently dropped:
// `spam`/`promotions` have no direct category, so they fall under `other`.
const CLASS_MAP: Record<string, ModerationCategory> = {
  sexual: 'sexual',
  hate: 'hate',
  violence: 'violence',
  bullying: 'harassment',
  spam: 'other',
  promotions: 'other',
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

// Split text into <=maxLength pieces, preferring to break on whitespace so we
// don't slice through a word (which could mask a flagged term).
const chunkText = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLength, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
};

// Content is as bad as its worst chunk: keep the max score per category.
const mergeScores = (parts: ModerationScores[]): ModerationScores => {
  const merged: ModerationScores = {};
  for (const part of parts) {
    for (const [category, score] of Object.entries(part)) {
      if (typeof score === 'number' && Number.isFinite(score)) {
        const key = category as ModerationCategory;
        merged[key] = Math.max(merged[key] ?? 0, score);
      }
    }
  }
  return merged;
};

/**
 * Hive text-moderation adapter. A pure classifier: it scores text but keeps no
 * per-item record, so it exposes no `submitForReview`. Vendor specifics (URL,
 * `Token` auth, 0-3 score scale, 1024-char limit) stay confined here, and the
 * key/URL never appear in thrown errors.
 */
export const createHiveProvider = ({
  apiKey,
  apiUrl = DEFAULT_URL,
}: {
  apiKey: string;
  apiUrl?: string;
}): ModerationProvider => {
  const scoreChunk = async (chunk: string): Promise<ModerationScores> => {
    const response = await moderationFetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          authorization: `Token ${apiKey}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ text_data: chunk }),
      },
      SYNC_GATE_FETCH,
    );

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    return normalizeHiveScores(await response.json());
  };

  return {
    scoreText: async ({ content }) => {
      const chunks = chunkText(content, HIVE_MAX_TEXT_LENGTH);
      const perChunk = await Promise.all(chunks.map(scoreChunk));
      return mergeScores(perChunk);
    },
  };
};
