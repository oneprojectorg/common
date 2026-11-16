import type { User } from '@op/supabase/lib';

import { getInstance } from '../getInstance';
import { listPhaseProposals } from '../listPhaseProposals';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import type {
  ListReviewProposalsInput,
  ReviewProposalList,
} from '../schemas/reviews';

/**
 * The review page's "All proposals" list: the phase's submitted proposals,
 * newest first, filtered by title search and by every given category term.
 *
 * Gated like the tab itself: admins, or reviewers on a phase with open
 * reviews. The rows come from `listPhaseProposals`, so they are the ones
 * `proposal.list` would show the caller, minus drafts, in its item shape.
 */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  search,
  categoryIds,
  cursor,
  limit,
}: ListReviewProposalsInput & { user: User }): Promise<ReviewProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertCanReadPhaseReviews({
    instance,
    phaseId: phaseId ?? instance.currentStateId ?? undefined,
    user,
  });

  return await listPhaseProposals({
    processInstanceId,
    phaseIds: phaseId === undefined ? undefined : [phaseId],
    search,
    categoryIds,
    cursor,
    limit,
    user,
  });
}
