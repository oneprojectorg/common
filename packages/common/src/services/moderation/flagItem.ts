import type { ModerationFlag } from '@op/db/schema';
import { logger } from '@op/logging';

import type {
  ModerationItemType,
  ModerationMediaItem,
  ModerationProviderReference,
  ModerationReport,
  ModerationSubmission,
} from './types';

export interface FlagItemInput {
  itemType: ModerationItemType;
  itemId: string;
  /** Identifies this submission round; encoded into every ref sent to the
   *  provider, and verdicts must match it. */
  roundId: string;
  /** The profile raising the report, or `null` for an anonymous (sessionless)
   *  report. */
  flaggedByProfileId: string | null;
  reason?: string;
  /** Content shipped to the provider for the async verdict. */
  content: string;
  media?: ModerationMediaItem[];
  callbackUrl: string;
}

export interface FlagItemDeps {
  findOpenFlag: (
    itemType: ModerationItemType,
    itemId: string,
  ) => Promise<ModerationFlag | undefined>;
  /** `created: false` means a concurrent report won the insert race; the
   *  caller returns that flag without submitting a second round. */
  createPendingFlag: (input: {
    itemType: ModerationItemType;
    itemId: string;
    flaggedByProfileId: string | null;
    reason?: string;
  }) => Promise<{ flag: ModerationFlag; created: boolean }>;
  submitForReview?: (
    input: ModerationSubmission,
  ) => Promise<ModerationProviderReference>;
  /** Files the user's report against the just-submitted content — this, not
   *  the submit, is what raises a human-review case. */
  reportForReview?: (input: ModerationReport) => Promise<void>;
  /** The refs `submitForReview` will create, known before the provider is
   *  called. Required alongside `submitForReview`. */
  planRefs?: (
    input: Pick<
      ModerationSubmission,
      'itemType' | 'itemId' | 'roundId' | 'content' | 'media'
    >,
  ) => string[];
  /** Persists the round of tasks about to be submitted (one per ref). Called
   *  *before* `submitForReview` so a verdict can't arrive for an unrecorded
   *  task. */
  recordRound?: (
    itemType: ModerationItemType,
    itemId: string,
    roundId: string,
    submittedRefs: string[],
  ) => Promise<void>;
  /** Undoes the pending flag + round when the provider submit fails, so the
   *  user's retry isn't swallowed by the open-flag idempotency check. */
  rollback?: (flag: ModerationFlag) => Promise<void>;
}

/**
 * User-initiated flag. Records a `pending` flag (manual source), records the
 * round of tasks the submission fans out into, submits the content to the
 * provider, then files the user's report against it so a human moderator gets
 * a case; the provider's webhook later confirms it (→ flagged) or clears it
 * (→ dismissed). Idempotent: if the item already has an open flag, returns it
 * without a second record or submission. If the provider submit fails, the
 * pending flag and round are rolled back and the error propagates — otherwise
 * the flag would sit `pending` forever (nothing left to resolve it) and the
 * idempotency check would swallow every retry. A failed *report* is logged and
 * swallowed instead — see below.
 */
export const flagItem = async (
  input: FlagItemInput,
  deps: FlagItemDeps,
): Promise<{ flag: ModerationFlag }> => {
  const existing = await deps.findOpenFlag(input.itemType, input.itemId);
  if (existing) {
    return { flag: existing };
  }

  const { flag, created } = await deps.createPendingFlag({
    itemType: input.itemType,
    itemId: input.itemId,
    flaggedByProfileId: input.flaggedByProfileId,
    reason: input.reason,
  });

  // Lost the insert race to a concurrent report: that report owns the round
  // (and the rollback if its submit fails) — don't submit a duplicate.
  if (!created) {
    return { flag };
  }

  // Both early returns above skip the provider, so at most one report is filed
  // per item no matter how many users report it — report count is not a
  // brigade signal.

  if (deps.submitForReview && deps.planRefs) {
    const planned = deps.planRefs({
      itemType: input.itemType,
      itemId: input.itemId,
      roundId: input.roundId,
      content: input.content,
      media: input.media,
    });

    // Nothing to review (no text, no media): record the flag and stop. The
    // report is gated with it — a decision webhook carrying a round we never
    // recorded is dropped, so the moderator's ruling would do nothing.
    //
    // KNOWN GAP: `itemType: 'user'` is always here (profiles carry no reviewable
    // content), so profile reports never queue, and the inert `pending` flag
    // blocks every later report on that profile.
    if (planned.length > 0) {
      try {
        await deps.recordRound?.(
          input.itemType,
          input.itemId,
          input.roundId,
          planned,
        );
        await deps.submitForReview({
          itemType: input.itemType,
          itemId: input.itemId,
          roundId: input.roundId,
          content: input.content,
          media: input.media,
          callbackUrl: input.callbackUrl,
        });
      } catch (error) {
        await deps.rollback?.(flag);
        throw error;
      }

      // After the submit: the provider only associates a report with content of
      // the same ref it already ingested.
      //
      // Outside the rollback and swallowed on purpose — the content is ingested
      // either way, and dropping the round would leave the classifier verdict
      // unmatched, which also skips the mandatory CSAM/terrorism detach.
      //
      // KNOWN GAP: an edit after a report mints a new round and deletes this
      // one's rows, losing the moderator's ruling.
      try {
        await deps.reportForReview?.({
          itemType: input.itemType,
          itemId: input.itemId,
          roundId: input.roundId,
          reporterId: input.flaggedByProfileId,
          reason: input.reason,
        });
      } catch (error) {
        logger.error(
          'Moderation content was submitted but the user report failed to file — no human-review case was raised',
          {
            error,
            itemType: input.itemType,
            itemId: input.itemId,
            roundId: input.roundId,
          },
        );
      }
    }
  }

  return { flag };
};
