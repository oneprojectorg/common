import type { User } from '@op/supabase/lib';

import { getInstance } from '../getInstance';
import { listPhaseProposals } from '../listPhaseProposals';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import type {
  ListReviewProposalsInput,
  ReviewProposalList,
} from '../schemas/reviews';

/** The review page's All proposals tab, gated by `assertCanReadPhaseReviews`. */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  search,
  categoryIds,
  sort,
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
    sort,
    cursor,
    limit,
    user,
  });
}
