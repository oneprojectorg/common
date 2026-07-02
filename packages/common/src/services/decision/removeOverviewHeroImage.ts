import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { deleteStorageObject } from '../../utils/deleteStorageObject';
import { assertProfileAccess } from '../assert';
import { invalidateDecisionInstance } from './decisionCache';
import type { DecisionInstanceData } from './schemas/instanceData';
import { updateDecisionInstance } from './updateDecisionInstance';

export interface RemoveOverviewHeroImageInput {
  instanceId: string;
}

export interface RemoveOverviewHeroImageResult {
  heroImage: '';
}

/**
 * Clears a decision overview's hero image: admin-only, drops the stored path
 * (`instanceData.overview.heroImage` → empty string, which `getPublicUrl`
 * treats as no image) and deletes the underlying storage object so it doesn't
 * leak in the shared assets bucket. Setting the image goes through
 * {@link updateOverviewHeroImage}; both live behind dedicated endpoints so the
 * generic `updateDecisionInstance` mutation never has to accept a raw path.
 */
export async function removeOverviewHeroImage({
  input,
  user,
}: {
  input: RemoveOverviewHeroImageInput;
  user: User;
}): Promise<RemoveOverviewHeroImageResult> {
  const { instanceId } = input;

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

  const previousPath = (instance.instanceData as DecisionInstanceData)?.overview
    ?.heroImage;

  await updateDecisionInstance({
    instanceId,
    overview: { heroImage: '' },
    user,
  });
  await invalidateDecisionInstance(instanceId);

  if (previousPath) {
    await deleteStorageObject({ path: previousPath });
  }

  return { heroImage: '' };
}
