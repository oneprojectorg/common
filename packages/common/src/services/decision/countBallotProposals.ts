import { count, db } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { ballotProposalFilter } from './ballotProposalFilter';
import type { PhaseScopedInstance } from './getProposalsForPhase';

export async function countBallotProposals({
  instance,
  taxonomyTermId,
}: {
  instance: PhaseScopedInstance;
  taxonomyTermId?: string | null;
}): Promise<number> {
  const filter = await ballotProposalFilter({ instance, taxonomyTermId });

  if (filter.isEmpty) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(filter.where(proposals));

  return row?.total ?? 0;
}
