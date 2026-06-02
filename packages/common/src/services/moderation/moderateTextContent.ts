import { getModerationProvider } from './provider';
import type { ModerationDecision, ModerationProvider } from './types';

// Summed category score at or above which content is rejected.
const MODERATION_THRESHOLD = 1.0;

/**
 * Moderation gate for text content. Returns a pass/fail decision from the
 * summed category scores. A configured provider that errors lets the error
 * propagate so callers block the write; when no provider is configured the
 * feature is off and content passes. See `assertTextContentModerated` for the
 * throwing variant.
 */
export const moderateTextContent = async (
  content: string,
  provider: ModerationProvider | null = getModerationProvider(),
): Promise<ModerationDecision> => {
  // No provider configured (feature off) or attachment-only content with no
  // text to score: nothing to moderate.
  if (!provider || !content.trim()) {
    return {
      passed: true,
      scores: {},
      total: 0,
      threshold: MODERATION_THRESHOLD,
    };
  }

  const scores = await provider.scoreText({ content });
  const total = Object.values(scores).reduce(
    (sum, score) => sum + (score ?? 0),
    0,
  );

  return {
    passed: total < MODERATION_THRESHOLD,
    scores,
    total,
    threshold: MODERATION_THRESHOLD,
  };
};
