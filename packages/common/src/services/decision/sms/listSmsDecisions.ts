import { and, asc, db, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profiles,
} from '@op/db/schema';

import { memberProfileIds } from '../../access';
import { summarizeCurrentPhase } from '../summarizeCurrentPhase';

export interface SmsDecisionListItem {
  name: string;
  slug: string;
  votingOpen: boolean;
}

export async function listSmsDecisions({
  authUserId,
}: {
  authUserId: string;
}): Promise<Array<SmsDecisionListItem>> {
  const rows = await db
    .select({
      name: profiles.name,
      slug: profiles.slug,
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(profiles)
    .innerJoin(processInstances, eq(processInstances.profileId, profiles.id))
    .where(
      and(
        eq(profiles.type, EntityType.DECISION),
        eq(processInstances.status, ProcessStatus.PUBLISHED),
        inArray(profiles.id, memberProfileIds([authUserId])),
      ),
    )
    .orderBy(asc(profiles.name), asc(profiles.id));

  return rows
    .map(({ name, slug, instanceData, currentStateId }) => ({
      name,
      slug,
      votingOpen: summarizeCurrentPhase({ instanceData, currentStateId })
        .votingOpen,
    }))
    .sort((a, b) => Number(b.votingOpen) - Number(a.votingOpen));
}
