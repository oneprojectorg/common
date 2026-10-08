import { and, asc, db, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';

import type { DecisionInstanceData } from './schemas/instanceData';
import { isVotingPhase } from './utils/phaseSettings';

export interface SmsDecision {
  name: string;
  slug: string;
  votingOpen: boolean;
}

export async function listSmsDecisions({
  authUserId,
}: {
  authUserId: string;
}): Promise<Array<SmsDecision>> {
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
        inArray(
          profiles.id,
          db
            .select({ profileId: profileUsers.profileId })
            .from(profileUsers)
            .where(eq(profileUsers.authUserId, authUserId)),
        ),
      ),
    )
    .orderBy(asc(profiles.name), asc(profiles.id));

  return rows.map(({ name, slug, instanceData, currentStateId }) => {
    const phases = (instanceData as DecisionInstanceData | null)?.phases ?? [];
    const currentPhase = phases.find(
      (phase) => phase.phaseId === currentStateId,
    );
    return {
      name,
      slug,
      votingOpen: currentPhase ? isVotingPhase(currentPhase) : false,
    };
  });
}
