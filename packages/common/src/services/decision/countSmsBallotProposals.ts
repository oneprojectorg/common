import { count, db } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { buildSmsBallotProposalFilter } from './smsBallotScope';

export async function countSmsBallotProposals({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<number> {
  const filter = await buildSmsBallotProposalFilter({ processInstanceId });

  if (!filter) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(filter);

  return row?.total ?? 0;
}
