import { type SQL, and, db, eq, inArray } from '@op/db/client';
import { proposalCategories, proposals } from '@op/db/schema';

import {
  type PhaseScopedInstance,
  getPhaseProposalSqlScope,
} from './getProposalsForPhase';
import { votingEligiblePredicate } from './phaseEligibility';
import { isReadableByEveryone } from './proposalVisibility';

export interface BallotProposalFilter {
  isEmpty: boolean;
  where: (t: typeof proposals) => SQL | undefined;
}

export async function ballotProposalFilter({
  instance,
  taxonomyTermId,
}: {
  instance: PhaseScopedInstance;
  taxonomyTermId?: string | null;
}): Promise<BallotProposalFilter> {
  const scope = await getPhaseProposalSqlScope({ instance, authUserIds: [] });
  const termId = taxonomyTermId ?? null;

  return {
    isEmpty: scope.isEmpty,
    where: (t) =>
      and(
        eq(t.processInstanceId, instance.id),
        isReadableByEveryone(t),
        votingEligiblePredicate(t),
        scope.buildNonDraftFilter(t),
        termId
          ? inArray(
              t.id,
              db
                .select({ proposalId: proposalCategories.proposalId })
                .from(proposalCategories)
                .where(eq(proposalCategories.taxonomyTermId, termId)),
            )
          : undefined,
      ),
  };
}
