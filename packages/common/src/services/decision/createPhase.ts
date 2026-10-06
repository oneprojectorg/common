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

export { phaseDataSchema, type PhaseData } from './phaseHelpers';

/**
 * Creates a phase and the profile that carries its identity, in one
 * transaction.
 *
 * Manage resolves against the *process* profile, not the phase, so the caller
 * needs decisions ADMIN on the instance's profile. It writes no grants: an
 * open phase needs none, and invite-only grants are direct permissions written
 * when an invite is accepted.
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
