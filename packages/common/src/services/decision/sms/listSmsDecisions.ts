import { and, asc, db, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profiles,
} from '@op/db/schema';

import { memberProfileIds } from '../../access';
import { withInstancePhases } from '../readInstancePhases';
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
      instanceId: processInstances.id,
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

  const decisions = await Promise.all(
    rows.map(
      async ({ instanceId, name, slug, instanceData, currentStateId }) => {
        const instance = await withInstancePhases({
          instance: { id: instanceId, instanceData },
        });
        return {
          name,
          slug,
          votingOpen: summarizeCurrentPhase({
            instanceData: instance.instanceData,
            currentStateId,
          }).votingOpen,
        };
      },
    ),
  );

  return decisions.sort((a, b) => Number(b.votingOpen) - Number(a.votingOpen));
}
