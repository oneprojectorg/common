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
  /** Files the user's report against the just-submitted content, which is what
   *  raises a human-review case at the provider. Optional: without it the
   *  content is only analysed, and a report the classifiers read as clean
   *  never reaches a moderator. */
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
 * idempotency check would swallow every retry. A failure of the *report* is
 * logged and swallowed instead: the content is already ingested, so the flag
 * and its round must survive for the automated verdict (including the
 * mandatory-detach path) to land.
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

  // NOTE ON REPORT VOLUME: both early returns above (existing open flag, lost
  // insert race) skip the provider entirely, so at most ONE report is ever
  // filed per item — 50 users reporting the same post produce a single
  // community report. Provider-side report count is therefore not a usable
  // brigade signal for us today. Filing one per reporter would need the item's
  // current round looked up on the fast path; deliberately not done here.

  if (deps.submitForReview && deps.planRefs) {
    const planned = deps.planRefs({
      itemType: input.itemType,
      itemId: input.itemId,
      roundId: input.roundId,
      content: input.content,
      media: input.media,
    });

    // Nothing the provider would review (no text, no media): record the flag
    // and stop, rather than submitting an empty round.
    //
    // The report is gated on the same condition, on purpose. A bare report
    // WOULD raise a case in the provider's queue with no content attached, but
    // its resolution can't reach us: the decision webhook would carry a round
    // we never recorded, so `applyModerationVerdict` drops it and a moderator's
    // ruling silently does nothing on our side. We only file reports for items
    // whose verdicts we can actually act on.
    //
    // KNOWN GAP: `itemType: 'user'` is always in this bucket, because profiles
    // carry no moderatable text or media (see `resolveModerationItemText`). The
    // resulting flag is inert — `pending` is not in `HIDING_MODERATION_STATUSES`
    // so it hides nothing, `resolveModeration` has no caller so no admin queue
    // reads it, and the `findOpenFlag` check above makes it permanent, blocking
    // every later report on that profile. Closing this means giving profiles
    // reviewable content (bio, avatar) or an internal review surface — not
    // filing a report whose verdict we can't enforce.
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

      // Strictly after the submit: the provider associates a report with
      // already-ingested content of the same ref.
      //
      // Deliberately OUTSIDE the rollback above, and deliberately swallowed.
      // The content is already ingested and can't be un-ingested, so neither
      // alternative is clean:
      //  - Rolling back (or just dropping the round) would leave the
      //    provider's own verdict with nowhere to land — `applyModerationVerdict`
      //    no-ops on an unmatched round, which takes the MANDATORY DETACH path
      //    (CSAM/terrorism) down with it. Unacceptable.
      //  - Rethrowing would only mislead the reporter: the flag is already
      //    written, so their retry is swallowed by the `findOpenFlag` check
      //    above either way.
      // So the automated path is kept intact and the failure goes to ops.
      //
      // KNOWN RESIDUAL RISK: the pending flag is not durable. If the
      // classifiers then return all-clear, `applyModerationVerdict` dismisses
      // it (see its `aggregate.allResolved` branch), so the report leaves no
      // open flag behind. Not total loss — dismissal does NOT clear the
      // submission rows (`clearSubmissions` runs only in the rollback above),
      // so a later human `act` on the same round still lands and re-flags via
      // the `createFlag` branch. What IS lost for good is the case after the
      // item is edited: the edit mints a new round and `recordSubmissionRound`
      // deletes the old round's rows, after which a moderator's ruling on the
      // reported round is dropped and nothing re-files the report against the
      // new one. Closing that needs report state persisted on the flag; the
      // log line below is the interim signal.
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
