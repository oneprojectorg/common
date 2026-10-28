import { count, db, eq } from '@op/db/client';
import { type ProcessPhase, type Profile, processPhases } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import {
  type PhaseData,
  assertDecisionAdmin,
  assertPhaseCountFits,
  assertPhaseSchemasCompile,
  assertPhaseSettings,
  insertPhase,
} from './phaseHelpers';
import { writePhaseRowsToInstanceData } from './phaseRows';

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
    const locked = await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: processInstanceId,
    });

    const [existing] = await tx
      .select({ value: count() })
      .from(processPhases)
      .where(eq(processPhases.processInstanceId, processInstanceId));

    assertPhaseCountFits((existing?.value ?? 0) + 1);

    const created = await insertPhase({
      tx,
      processInstanceId,
      name,
      sortOrder,
      data: phaseData,
    });

    await writePhaseRowsToInstanceData({
      db: tx,
      processInstanceId,
      instanceData: locked.instanceData,
    });

    return created;
  });
};
