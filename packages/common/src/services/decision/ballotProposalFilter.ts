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

const districtTermId = async (boundaryId: string): Promise<string | null> => {
  const boundary = await db.query.decisionBoundaries.findFirst({
    where: { id: boundaryId },
    columns: { taxonomyTermId: true },
  });
  return boundary?.taxonomyTermId ?? null;
};

export async function ballotProposalFilter({
  instance,
  boundaryId,
}: {
  instance: PhaseScopedInstance;
  boundaryId?: string | null;
}): Promise<BallotProposalFilter> {
  const [scope, termId] = await Promise.all([
    getPhaseProposalSqlScope({ instance, authUserIds: [] }),
    boundaryId ? districtTermId(boundaryId) : null,
  ]);

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
