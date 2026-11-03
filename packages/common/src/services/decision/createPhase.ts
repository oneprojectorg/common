import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { invalidateDecisionInstance } from './decisionCache';
import {
  type PhaseData,
  assertDecisionAdmin,
  assertPhaseCountFits,
  assertPhaseSchemasCompile,
  assertPhaseSettings,
  insertPhase,
} from './phaseHelpers';
import { mutatePhases } from './phaseMirror';

export const createPhase = async ({
  user,
  processInstanceId,
  name,
  sortOrder,
  data,
}: {
  user: User;
  processInstanceId: string;
  name: string;
  sortOrder: number;
  data?: PhaseData;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision', processInstanceId);
  }

  await assertDecisionAdmin({ user, decisionProfileId: instance.profileId });

  const phaseData = data ?? {};
  assertPhaseSchemasCompile(phaseData);
  assertPhaseSettings({ data: phaseData, phaseLabel: name });

  const created = await db.transaction(async (tx) => {
    const { result } = await mutatePhases({
      db: tx,
      processInstanceId,
      mutate: ({ phases, unmintedPhases }) => {
        assertPhaseCountFits(phases.length + unmintedPhases.length + 1);
        return insertPhase({
          tx,
          processInstanceId,
          name,
          sortOrder,
          data: phaseData,
        });
      },
    });
    return result;
  });

  await invalidateDecisionInstance(processInstanceId);

  return created;
};
