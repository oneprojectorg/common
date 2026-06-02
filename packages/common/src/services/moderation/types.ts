/** Vendor-agnostic moderation contracts. The concrete provider lives in `provider.ts`. */

export type ModerationCategory =
  | 'profanity'
  | 'sexual'
  | 'hate'
  | 'violence'
  | 'harassment';

export type ModerationScores = Partial<Record<ModerationCategory, number>>;

export interface ModerationDecision {
  passed: boolean;
  scores: ModerationScores;
  total: number;
  threshold: number;
}

/** Scores a piece of text across categories. */
export interface ModerationProvider {
  scoreText(input: { content: string }): Promise<ModerationScores>;
}
