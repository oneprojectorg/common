import type { ModerationFlag } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

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
import {
  resolveModerationItemText,
  resolveModerationMedia,
} from './resolveModerationMedia';
import type { ModerationItemType } from './types';

export interface SubmitUserFlagInput {
  itemType: ModerationItemType;
  itemId: string;
  flaggedByProfileId: string;
  reason?: string;
  /** The reporting user; must be able to read the item they're flagging. */
  user: User;
}

/**
 * User-initiated report. Verifies the reporter can read the item (flagging
 * ships its content to the external provider), records a `pending` flag and,
 * when a provider + webhook secret are configured, submits the item (text +
 * media) for an async verdict. Idempotent on an item's open flag.
 */
export const submitUserFlag = async (
  input: SubmitUserFlagInput,
): Promise<{ flag: ModerationFlag; created: boolean }> => {
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
  const existing = await findOpenModerationFlag(input.itemType, input.itemId);
  if (existing) {
    return { flag: existing, created: false };
  }

  const provider = getModerationProvider();
  const callbackUrl = getModerationCallbackUrl();
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
      flaggedByProfileId: input.flaggedByProfileId,
      reason: input.reason,
      content,
      media,
      callbackUrl: callbackUrl ?? '',
    },
    {
      findOpenFlag: findOpenModerationFlag,
      createPendingFlag,
      // Submit only when a provider with the full async surface and a callback
      // URL are configured; otherwise the flag stays pending for manual/admin
      // handling.
      submitForReview:
        provider?.submitForReview && provider.planReviewRefs && callbackUrl
          ? provider.submitForReview
          : undefined,
      planRefs: provider?.planReviewRefs,
      recordRound: (itemType, itemId, round, refs) =>
        recordSubmissionRound(
          itemType,
          itemId,
          round,
          submissionMediaIdsFromRefs(refs),
        ),
      rollback: async (flag) => {
        await deletePendingFlag(flag.id);
        await clearSubmissions(input.itemType, input.itemId);
      },
    },
  );
};
