import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
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

  return db.transaction(async (tx) => {
    const { result } = await mutatePhases({
      db: tx,
      processInstanceId,
      mutate: ({ phases }) => {
        assertPhaseCountFits(phases.length + 1);
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
};
