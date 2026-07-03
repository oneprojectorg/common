import { Events, event } from '@op/events';

import { detachProposalForModeration } from '../decision/detachProposalForModeration';
import {
  type ApplyModerationVerdictResult,
  applyModerationVerdict,
} from './applyModerationVerdict';
import {
  createAutomatedFlag,
  findOpenModerationFlag,
  markFlagDismissed,
  markFlagFlagged,
} from './moderationFlagStore';
import {
  recordSubmissionVerdict,
  toSubmissionMediaId,
} from './moderationSubmissionStore';
import type { ModerationItemType, ModerationVerdict } from './types';

// A detach verdict is only actionable when the item is a proposal — that's
// the content that owes a decision-process attachment. Post/user detaches
// would need their own model surface; if Checkstep ever returns a detach
// policy against those, we still create a flag (so the item is hidden and ops
// is notified), but the detach step is a no-op rather than a silent failure.
const detachContentByItemType = async ({
  itemType,
  itemId,
}: {
  itemType: ModerationItemType;
  itemId: string;
}): Promise<void> => {
  if (itemType === 'proposal') {
    await detachProposalForModeration({ proposalId: itemId });
  }
};

/**
 * Applies a parsed provider verdict against the database. The real wiring of
 * `applyModerationVerdict`: looks up the open flag, creates/confirms/dismisses
 * via the flag store, and emits `content/flagged` so the author notification
 * fires. On a detach verdict (child exploitation / terrorism by default) the
 * item is also detached from its process (today proposals only). Called by
 * the webhook handler.
 */
export const recordModerationVerdict = (
  verdict: ModerationVerdict,
): Promise<ApplyModerationVerdictResult> =>
  applyModerationVerdict(verdict, {
    recordTaskVerdict: ({ itemType, itemId, roundId, mediaId, ...patch }) =>
      recordSubmissionVerdict({
        itemType,
        itemId,
        mediaId: toSubmissionMediaId(mediaId),
        roundId,
        ...patch,
      }),
    findOpenFlag: findOpenModerationFlag,
    createFlag: createAutomatedFlag,
    markFlagged: markFlagFlagged,
    markDismissed: markFlagDismissed,
    emitFlagged: async ({ itemType, itemId, moderationFlagId }) => {
      await event.send({
        name: Events.contentFlagged.name,
        data: { itemType, itemId, moderationFlagId },
      });
    },
    detachContent: detachContentByItemType,
  });
