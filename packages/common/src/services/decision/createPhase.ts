import { db } from '@op/db/client';
import type { ProcessPhase, Profile } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import {
  type PhaseData,
  assertDecisionAdmin,
  insertPhase,
  phaseDataSchema,
} from './phaseHelpers';

/**
 * Creates a phase and the profile that carries its identity, in one
 * transaction.
 *
 * Phase management is authorized against the decision's profile, not the
 * phase's, so the caller needs decisions ADMIN on the instance's profile.
 * Writes no grants.
 */
export const createPhase = async ({
  user,
  processInstanceId,
  name,
  sortOrder,
  data,
}: {
  user: User;
  processInstanceId: string;
  /** Stored on the profile, not on the phase row. */
  name: string;
  sortOrder: number;
  data: PhaseData;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  const phaseData = phaseDataSchema.parse(data);

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
