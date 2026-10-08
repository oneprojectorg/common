import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import {
  type PhaseData,
  assertDecisionAdmin,
  assertPhaseSchemasCompile,
  assertPhaseSettings,
  insertPhase,
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
