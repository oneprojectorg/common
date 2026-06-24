import { Events, safeInngestSend } from '@op/events';

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
import type { ModerationVerdict } from './types';

/**
 * Applies a parsed provider verdict against the database. The real wiring of
 * `applyModerationVerdict`: looks up the open flag, creates/confirms/dismisses
 * via the flag store, and emits `content/flagged` so the author notification
 * fires. Called by the webhook handler.
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
    emitFlagged: ({ itemType, itemId, moderationFlagId }) =>
      safeInngestSend({
        name: Events.contentFlagged.name,
        data: { itemType, itemId, moderationFlagId },
      }),
  });
