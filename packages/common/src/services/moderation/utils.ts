import type { ModerationScores } from './types';

/**
 * Merges per-category moderation scores across any number of maps, keeping the
 * worst (highest) score per category — content is as bad as its worst part
 * (text chunk, attachment, task). Non-finite scores are ignored.
 *
 * This is the single place the `Object.entries` key widens back to a
 * `ModerationCategory`, so the cast lives here rather than at each caller.
 */
export const mergeModerationScores = (
  ...parts: Array<ModerationScores | null | undefined>
): ModerationScores => {
  const merged: ModerationScores = {};
  for (const part of parts) {
    if (!part) {
      continue;
    }
    for (const [category, score] of Object.entries(part)) {
      if (typeof score === 'number' && Number.isFinite(score)) {
        const key = category as keyof ModerationScores;
        merged[key] = Math.max(merged[key] ?? 0, score);
      }
    }
  }
  return merged;
};
