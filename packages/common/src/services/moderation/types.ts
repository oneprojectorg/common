/** Vendor-agnostic moderation contracts. Concrete providers live in `providers/`. */

export type ModerationCategory =
  | 'profanity'
  | 'sexual'
  | 'hate'
  | 'violence'
  | 'harassment'
  // Verdict-based platforms (Lasso/Checkstep) don't always classify; `other`
  // carries a decisive score when only an allow/block verdict is available.
  | 'other';

export type ModerationScores = Partial<Record<ModerationCategory, number>>;

export interface ModerationDecision {
  passed: boolean;
  scores: ModerationScores;
  total: number;
  threshold: number;
}

/** The moderation vendors we support; the active one is chosen by env. */
export type ModerationVendor = 'hive' | 'lasso' | 'checkstep';

/** What kind of entity is being submitted for async review. */
export type ModerationSubjectType = 'proposal' | 'post' | 'user';

/**
 * Reference to the record on the external provider. The dispute/review URL is
 * generated downstream from `providerRecordId` (the provider is fixed by
 * config), so it isn't carried here. Only platform vendors (Lasso/Checkstep)
 * expose a record id; pure classifiers (Hive) do not.
 */
export interface ModerationProviderReference {
  providerName: string;
  providerRecordId?: string;
}

export interface ModerationSubmission {
  subjectType: ModerationSubjectType;
  subjectId: string;
  content: string;
  authorRef?: string;
}

/**
 * Scores text (sync gate) and — for platform vendors — submits content for
 * async review, returning a click-through reference. `submitForReview` is
 * optional: present on Lasso/Checkstep, absent on Hive.
 */
export interface ModerationProvider {
  scoreText(input: { content: string }): Promise<ModerationScores>;
  submitForReview?(
    input: ModerationSubmission,
  ): Promise<ModerationProviderReference>;
}
