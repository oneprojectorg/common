import { db } from '@op/db/client';
import type { ModerationFlag } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { getCurrentProfileId } from '../access';
import { assertModerationItemAccess } from './assertModerationItemAccess';
import { flagItem } from './flagItem';
import { getModerationCallbackUrl } from './moderationCallback';
import {
  createPendingFlag,
  deletePendingFlag,
  findOpenModerationFlag,
} from './moderationFlagStore';
import {
  clearSubmissions,
  recordSubmissionRound,
  submissionMediaIdsFromRefs,
} from './moderationSubmissionStore';
import { getModerationProvider } from './provider';
import { resolveModerationItemText } from './resolveModerationItemText';
import { resolveModerationMedia } from './resolveModerationMedia';
import type { ModerationItemType } from './types';

export interface SubmitUserFlagInput {
  itemType: ModerationItemType;
  itemId: string;
  reason?: string;
  /**
   * The reporting user, or `undefined` for a sessionless caller. Either way the
   * caller must be able to *read* the item they're flagging — a sessionless
   * caller is held to public visibility (see {@link assertModerationItemAccess}).
   * A sessionless report records a `null` reporter.
   */
  user?: User;
}

/**
 * User-initiated report. Verifies the reporter can read the item (flagging
 * ships its content to the external provider), records a `pending` flag and,
 * when a provider + webhook secret are configured, submits the item (text +
 * media) for an async verdict and files the report that puts it in the
 * provider's human-review queue. Idempotent on an item's open flag.
 */
export const submitUserFlag = async (
  input: SubmitUserFlagInput,
): Promise<{ flag: ModerationFlag }> => {
  // Resolve the reporter's profile (memoized per request, so the access gate's
  // own getCurrentProfileId call reuses it) alongside the open-flag lookup —
  // they're independent, and the open flag is the idempotency shortcut below. A
  // sessionless report has no reporter profile.
  const [flaggedByProfileId, existing] = await Promise.all([
    input.user ? getCurrentProfileId(input.user.id) : Promise.resolve(null),
    findOpenModerationFlag(input.itemType, input.itemId),
  ]);

  await assertModerationItemAccess({
    itemType: input.itemType,
    itemId: input.itemId,
    user: input.user,
  });

  // Idempotency shortcut: if the item already has an open flag, return it
  // before resolving content. Resolving means a TipTap fetch + signing one URL
  // per attachment — wasted work on the hot case (many users reporting the
  // same already-flagged item). `flagItem` still does its own authoritative
  // open-flag check, so this is a fast path, not the correctness boundary.
  if (existing) {
    return { flag: existing };
  }

  const provider = getModerationProvider();
  const callbackUrl = getModerationCallbackUrl();
  // One gate for both provider calls so they can't drift apart: hand them over
  // only when a provider exposing the full async surface AND a callback URL are
  // configured. Without that the flag is recorded locally and nothing is sent —
  // a report can only attach to content we actually ingested, and a case whose
  // decision webhook we can't receive can't be enforced on our side (see the
  // gating note in `flagItem`).
  const asyncReview =
    provider?.submitForReview && provider.planReviewRefs && callbackUrl
      ? {
          submitForReview: provider.submitForReview,
          reportForReview: provider.reportForReview,
        }
      : undefined;
  // Fresh round per report: encoded into the provider refs, so only this
  // round's verdicts can land on the rows recorded below.
  const roundId = crypto.randomUUID();
  const [content, media] = await Promise.all([
    resolveModerationItemText(input.itemType, input.itemId),
    resolveModerationMedia(input.itemType, input.itemId),
  ]);

  return flagItem(
    {
      itemType: input.itemType,
      itemId: input.itemId,
      roundId,
      flaggedByProfileId,
      reason: input.reason,
      content,
      media,
      callbackUrl: callbackUrl ?? '',
    },
    {
      findOpenFlag: findOpenModerationFlag,
      createPendingFlag,
      submitForReview: asyncReview?.submitForReview,
      reportForReview: asyncReview?.reportForReview,
      planRefs: provider?.planReviewRefs,
      recordRound: (itemType, itemId, round, refs) =>
        recordSubmissionRound(
          itemType,
          itemId,
          round,
          submissionMediaIdsFromRefs(refs),
        ),
      rollback: async (flag) => {
        // One transaction so the undo can't half-apply: either the pending
        // flag and its submission rows both go, or neither does and the
        // original error propagates for retry. A partial rollback would either
        // strand the flag `pending` forever or leave orphan submission rows.
        await db.transaction(async (tx) => {
          await deletePendingFlag(flag.id, tx);
          await clearSubmissions(input.itemType, input.itemId, tx);
        });
      },
    },
  );
};
