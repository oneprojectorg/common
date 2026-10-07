import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import {
  type PhaseDataInput,
  assertDecisionAdmin,
  assertPhaseSettings,
  insertPhase,
  toPhaseDataPatch,
} from './phaseHelpers';

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
  data?: PhaseDataInput;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  const phaseData = toPhaseDataPatch(data ?? {}).set;
  assertPhaseSettings({ data: phaseData, phaseLabel: name });

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision', processInstanceId);
  }

  await assertDecisionAdmin({ user, decisionProfileId: instance.profileId });

  return db.transaction((tx) =>
    insertPhase({
      tx,
      processInstanceId,
      name,
      sortOrder,
      data: phaseData,
    }),
  );
};
