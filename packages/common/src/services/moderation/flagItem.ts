import type { ModerationFlag } from '@op/db/schema';

import type {
  ModerationItemType,
  ModerationMediaItem,
  ModerationProviderReference,
  ModerationSubmission,
} from './types';

export interface FlagItemInput {
  itemType: ModerationItemType;
  itemId: string;
  /** Identifies this submission round; encoded into every ref sent to the
   *  provider, and verdicts must match it. */
  roundId: string;
  /** The profile raising the report. */
  flaggedByProfileId: string;
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
    flaggedByProfileId: string;
    reason?: string;
  }) => Promise<{ flag: ModerationFlag; created: boolean }>;
  submitForReview?: (
    input: ModerationSubmission,
  ) => Promise<ModerationProviderReference>;
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
 * round of tasks the submission fans out into, then submits the content to the
 * provider; the provider's webhook later confirms it (→ flagged) or clears it
 * (→ dismissed). Idempotent: if the item already has an open flag, returns it
 * without a second record or submission. If the provider submit fails, the
 * pending flag and round are rolled back and the error propagates — otherwise
 * the flag would sit `pending` forever (nothing left to resolve it) and the
 * idempotency check would swallow every retry.
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

  if (deps.submitForReview && deps.planRefs) {
    const planned = deps.planRefs({
      itemType: input.itemType,
      itemId: input.itemId,
      roundId: input.roundId,
      content: input.content,
      media: input.media,
    });

    // Nothing the provider would review (no text, no media): keep the flag
    // pending for manual/admin handling rather than submitting an empty round.
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
    }
  }

  return { flag };
};
