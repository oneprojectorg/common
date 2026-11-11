import { and, count, db, isNotNull } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { getBallotProposalFilter } from './getBallotProposalFilter';
import type { PhaseScopedInstance } from './getProposalsForPhase';

export async function countBallotProposals({
  instance,
  taxonomyTermId,
}: {
  instance: PhaseScopedInstance;
  taxonomyTermId?: string | null;
}): Promise<number> {
  const filter = await getBallotProposalFilter({ instance, taxonomyTermId });

  if (filter.isEmpty) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(and(filter.where(proposals), isNotNull(proposals.shortCode)));

  return row?.total ?? 0;
}
