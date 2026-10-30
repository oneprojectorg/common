import { and, asc, db, eq, gt, isNotNull } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import {
  type BallotInstance,
  priceBallotProposals,
} from './ballotProposalCosts';
import { ballotProposalFilter } from './ballotProposalFilter';

export interface BallotProposalListItem {
  id: string;
  code: number;
  title: string;
  cost: string | null;
}

export interface BallotProposalPage {
  items: BallotProposalListItem[];
  nextCursor: number | null;
}

export async function listBallotProposals({
  instance,
  taxonomyTermId,
  after,
  limit,
}: {
  instance: BallotInstance;
  taxonomyTermId?: string | null;
  after?: number;
  limit: number;
}): Promise<BallotProposalPage> {
  const filter = await ballotProposalFilter({ instance, taxonomyTermId });

  if (filter.isEmpty) {
    return { items: [], nextCursor: null };
  }

  const rows = await db
    .select({
      id: proposals.id,
      code: proposals.shortCode,
      title: profiles.name,
      proposalData: proposals.proposalData,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(
      and(
        filter.where(proposals),
        isNotNull(proposals.shortCode),
        after === undefined ? undefined : gt(proposals.shortCode, after),
      ),
    )
    .orderBy(asc(proposals.shortCode))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const costs = await priceBallotProposals({ instance, proposals: page });
  const last = page[page.length - 1];

  return {
    items: page.flatMap(({ id, code, title }) =>
      code === null ? [] : [{ id, code, title, cost: costs.get(id) ?? null }],
    ),
    nextCursor: rows.length > limit && last?.code != null ? last.code : null,
  };
}
