import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { deleteStorageObject } from '../../utils/deleteStorageObject';
import { assertProfileAccess } from '../assert';
import { invalidateDecisionInstance } from './decisionCache';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface RemovePhaseHeroImageInput {
  instanceId: string;
  phaseId: string;
}

export interface RemovePhaseHeroImageResult {
  heroImage: '';
}

/**
 * Clears a decision phase's hero image: admin-only, drops the stored path
 * (`instanceData.phases[i].heroImage`) and deletes the underlying storage
 * object so it doesn't leak in the shared assets bucket. Setting the image goes
 * through {@link updatePhaseHeroImage}; both write `instanceData.phases`
 * directly so the generic `updateDecisionInstance` mutation never has to accept
 * a raw path.
 */
export async function removePhaseHeroImage({
  input,
  user,
}: {
  input: RemovePhaseHeroImageInput;
  user: User;
}): Promise<RemovePhaseHeroImageResult> {
  const { instanceId, phaseId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { profileId: true, instanceData: true },
  });
  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', instanceId);
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  const instanceData = instance.instanceData as DecisionInstanceData;
  const phases = instanceData?.phases ?? [];
  const targetPhase = phases.find((phase) => phase.phaseId === phaseId);
  if (!targetPhase) {
    throw new NotFoundError('Phase', phaseId);
  }

  const previousPath = targetPhase.heroImage;

  // Nothing stored — no write or cleanup needed.
  if (!previousPath) {
    return { heroImage: '' };
  }

  const updatedInstanceData: DecisionInstanceData = {
    ...instanceData,
    phases: phases.map((phase) =>
      phase.phaseId === phaseId ? { ...phase, heroImage: '' } : phase,
    ),
  };

  const [updated] = await db
    .update(processInstances)
    .set({ instanceData: updatedInstanceData })
    .where(eq(processInstances.id, instanceId))
    .returning({ id: processInstances.id });
  if (!updated) {
    throw new CommonError('Failed to update decision process instance');
  }

  await invalidateDecisionInstance(instanceId);
  await deleteStorageObject({ path: previousPath });

  return { heroImage: '' };
}
