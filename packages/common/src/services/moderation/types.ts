import type { ModerationItemType as ModerationItemTypeEnum } from '@op/db/schema';

/** Vendor-agnostic moderation contracts. Concrete providers live in `providers/`. */

export type ModerationCategory =
  | 'profanity'
  | 'sexual'
  | 'hate'
  | 'violence'
  | 'harassment'
  // CSAM is treated as its own category so the verdict pipeline can trigger
  // the mandatory-detach path without relying on Checkstep policy strings.
  | 'csam'
  // Checkstep doesn't always classify; `other` carries a decisive score when
  // only an allow/block verdict is available.
  | 'other';

export type ModerationScores = Partial<Record<ModerationCategory, number>>;

/** The moderation vendor we support. */
export type ModerationVendor = 'checkstep';

/** What kind of item is moderated. Derived from the db `ModerationItemType`
 *  enum (as its value union) so the service and schema never drift. */
export type ModerationItemType = `${ModerationItemTypeEnum}`;

/**
 * Reference to the record on the external provider. The dispute/review URL is
 * generated downstream from `providerRecordId` (the provider is fixed by
 * config).
 */
export interface ModerationProviderReference {
  providerRecordId?: string;
  /**
   * The content-refs the provider actually submitted, one per task. Checkstep
   * takes one combined task (text + media as fields), so this is a single
   * ref today, but the shape is kept plural so aggregation across tasks stays
   * uniform if the split ever changes.
   */
  submittedRefs: string[];
}

/** Broad media category, derived from an attachment's MIME type, so each
 *  provider routes the URL to the right slot (an image field vs a video field)
 *  instead of moderating everything as an image. `other` covers types the
 *  vendors can't review (e.g. PDFs/docs). */
export type ModerationMediaKind = 'image' | 'video' | 'audio' | 'other';

export interface ModerationMediaItem {
  url: string;
  kind: ModerationMediaKind;
}

export interface ModerationSubmission {
  itemType: ModerationItemType;
  itemId: string;
  /**
   * Identifies this submission round; encoded into every content ref so the
   * webhook verdicts can be matched to the exact round they were issued for.
   * A re-submission mints a new id, invalidating in-flight verdicts for the
   * superseded round.
   */
  roundId: string;
  content: string;
  /** Publicly-fetchable attachment URLs (with their kind) to moderate with the
   *  text. */
  media?: ModerationMediaItem[];
  /** Where the provider POSTs its async verdict for this submission. */
  callbackUrl: string;
}

/**
 * A user-initiated report filed against already-submitted content. Distinct
 * from {@link ModerationSubmission}: that ingests content for analysis, this
 * tells the provider a human complained. Cases are queued off the report.
 */
export interface ModerationReport {
  itemType: ModerationItemType;
  itemId: string;
  /** The round this report is filed against, so it lands on the same
   *  provider-side record. */
  roundId: string;
  /** Stable id of the reporting user, or `null` for a sessionless report. */
  reporterId: string | null;
  /** Surfaced verbatim in the provider's moderation UI. */
  reason?: string;
}

/** Raw inbound provider webhook, before vendor-specific parsing. */
export interface ModerationWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
}

/**
 * A provider's async decision, normalized across vendors. `itemType`/`itemId`
 * are recovered from the content ref we submitted (see `contentRef`), so the
 * webhook can be correlated back to the item with no pending DB row.
 */
export interface ModerationVerdict {
  itemType: ModerationItemType;
  itemId: string;
  /**
   * The submission round this verdict answers, recovered from the content
   * ref. A verdict whose round doesn't match the recorded round is stale (or
   * forged) and is dropped.
   */
  roundId: string;
  /**
   * Which task within the item this verdict is for, recovered from the content
   * ref's media segment (`undefined` = the item's text task). Lets the webhook
   * record a per-task verdict and aggregate across an item's tasks.
   */
  mediaId?: string;
  /**
   * `flagged` = provider deems the content disallowed; `clear` = allowed;
   * `detach` = the content matched a mandatory-detach policy (child
   * exploitation or terrorism by default) — a distinct verdict so the
   * pipeline removes the proposal from its process outright (admin views
   * included) instead of the ordinary hide.
   */
  verdict: 'flagged' | 'clear' | 'detach';
  /** The provider's record/task id, for dispute/review links. */
  externalRecordId?: string;
  /** Human-readable reason (matched rule/policy names). */
  reason?: string;
  /** Per-category scores when the provider supplies them. */
  scores?: ModerationScores;
}

/**
 * Submits content for async review and parses the resulting webhook.
 * `submitForReview`/`planReviewRefs`/`parseWebhook` form the async review path;
 * `reportForReview` adds the user-report signal on top of it, and
 * `verifyWebhook` guards inbound callbacks for vendors that sign them.
 */
export interface ModerationProvider {
  /**
   * The content-refs `submitForReview` will create for this submission,
   * computable without calling the provider. The round is recorded from these
   * *before* the submit, so a verdict can never arrive for a task we haven't
   * recorded — required alongside `submitForReview` for the async path.
   */
  planReviewRefs?(
    input: Pick<
      ModerationSubmission,
      'itemType' | 'itemId' | 'roundId' | 'content' | 'media'
    >,
  ): string[];
  submitForReview?(
    input: ModerationSubmission,
  ): Promise<ModerationProviderReference>;
  /**
   * Files a user report against content `submitForReview` just submitted, so
   * the provider raises a case for a human. Ingestion alone only runs the
   * classifiers, which raise nothing on content they read as clean — exactly
   * what a human report exists to catch. Called after `submitForReview`.
   */
  reportForReview?(input: ModerationReport): Promise<void>;
  /**
   * Extracts the verdicts a webhook delivery carries. Checkstep sends one
   * verdict per callback and also ships non-verdict webhook types (author
   * decisions, incident-closed, analysed-content) — an empty array means
   * "nothing for us, acknowledge with 200". Throws on a malformed payload
   * (→ 400).
   */
  parseWebhook?(input: ModerationWebhookInput): ModerationVerdict[];
  /**
   * Verifies the vendor's webhook signature against the raw request. Providers
   * that sign their callbacks implement this; the webhook handler rejects the
   * request when verification fails. Absent for vendors with no documented
   * signing (the shared-secret callback URL is the only gate there).
   */
  verifyWebhook?(input: ModerationWebhookInput): boolean;
}
