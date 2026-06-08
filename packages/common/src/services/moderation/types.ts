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
 * Link back to the record on the external provider, so an admin/owner can click
 * through to review or dispute. Only platform vendors (Lasso/Checkstep) expose
 * one; pure classifiers (Hive) do not.
 */
export interface ModerationProviderReference {
  providerName: string;
  providerRecordId?: string;
  providerUrl?: string;
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
