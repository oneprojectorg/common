import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { deleteStorageObject } from '../../utils/deleteStorageObject';
import {
  IMAGE_UPLOAD_SIZE_LIMIT,
  assertUploadedStorageObject,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { assertProfileAccess } from '../assert';
import { invalidateDecisionInstance } from './decisionCache';
import { phaseHeroImagePathPrefix } from './phaseHeroImageStorage';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface UpdatePhaseHeroImageInput {
  instanceId: string;
  phaseId: string;
  /** Path of the storage object the client just uploaded into. */
  storagePath: string;
  /** Client-declared MIME type; must match what storage recorded on PUT. */
  mimeType: string;
}

export interface UpdatePhaseHeroImageResult {
  heroImage: string;
}

/**
 * Records the hero image a client uploaded directly to storage via a signed
 * URL (see {@link signPhaseHeroImageUploadUrl}). Re-asserts admin, then runs the
 * shared storage trust-boundary check (path prefix, stored Content-Type on the
 * allowlist matching the declared type, size cap) and requires the object to be
 * an image before persisting its path into the phase's `heroImage`.
 *
 * Writes `instanceData.phases[i].heroImage` directly rather than going through
 * `updateDecisionInstance`, because that mutation replaces the whole phases
 * array (dropping siblings) and recomputes transitions — neither of which we
 * want for a single image change. The read-modify-write shares the same
 * (admin-only, debounced) race window as the phase autosave; the autosave's
 * per-phase merge spreads `...existing`, so a stored heroImage is preserved
 * across unrelated field saves. Clearing goes through {@link removePhaseHeroImage}.
 */
export async function updatePhaseHeroImage({
  input,
  user,
}: {
  input: UpdatePhaseHeroImageInput;
  user: User;
}): Promise<UpdatePhaseHeroImageResult> {
  const { instanceId, phaseId, storagePath, mimeType } = input;

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

  const storageObject = await getStorageObjectByPath({ path: storagePath });
  const { storedMimeType } = assertUploadedStorageObject({
    storageObject,
    storagePath,
    requiredPathPrefix: phaseHeroImagePathPrefix(instanceId, phaseId),
    declaredMimeType: mimeType,
    maxFileSize: IMAGE_UPLOAD_SIZE_LIMIT,
  });
  // The shared allowlist also permits PDFs / office docs; the hero is
  // image-only, so reject anything that isn't an image.
  if (!storedMimeType.startsWith('image/')) {
    throw new ValidationError('Hero image must be an image file');
  }

  // Previous object, so we can drop it once the new path is persisted (a
  // replaced hero image would otherwise leak in the shared assets bucket).
  const previousPath = targetPhase.heroImage;

  const updatedInstanceData: DecisionInstanceData = {
    ...instanceData,
    phases: phases.map((phase) =>
      phase.phaseId === phaseId ? { ...phase, heroImage: storagePath } : phase,
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

  if (previousPath && previousPath !== storagePath) {
    await deleteStorageObject({ path: previousPath });
  }

  return { heroImage: storagePath };
}
