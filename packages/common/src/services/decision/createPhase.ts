import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError } from '../../utils';
import {
  type PhaseData,
  assertDecisionAdmin,
  assertPhaseEndsOnOrAfterStart,
  assertPhaseSchemasCompile,
  assertPhaseSettings,
  insertPhase,
} from './phaseHelpers';
import { writePhasesWithLock } from './phaseWrites';

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
  assertPhaseEndsOnOrAfterStart({ data: phaseData, phaseLabel: name });

  const { result: created, phases } = await writePhasesWithLock({
    processInstanceId,
    write: (tx) =>
      insertPhase({
        tx,
        processInstanceId,
        name,
        sortOrder,
        data: phaseData,
      }),
  });
  const placed = phases.find(({ id }) => id === created.phase.id);
  if (!placed) {
    throw new CommonError(`Phase ${created.phase.id} is missing after insert`);
  }

  return {
    ...created,
    phase: { ...created.phase, sortOrder: placed.sortOrder },
  };
};
