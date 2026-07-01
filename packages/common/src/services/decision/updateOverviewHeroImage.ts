import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import {
  DEFAULT_UPLOAD_SIZE_LIMIT,
  assertUploadedStorageObject,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { assertProfileAccess } from '../assert';
import { invalidateDecisionInstance } from './decisionCache';
import { overviewHeroImagePathPrefix } from './overviewHeroImageStorage';
import { updateDecisionInstance } from './updateDecisionInstance';

export interface UpdateOverviewHeroImageInput {
  instanceId: string;
  /** Path of the storage object the client just uploaded into. */
  storagePath: string;
  /** Client-declared MIME type; must match what storage recorded on PUT. */
  mimeType: string;
}

export interface UpdateOverviewHeroImageResult {
  heroImage: string;
}

/**
 * Records the hero image a client uploaded directly to storage via a signed
 * URL (see {@link signOverviewHeroImageUploadUrl}). Re-asserts admin, then
 * runs the shared storage trust-boundary check (path prefix, stored
 * Content-Type on the allowlist matching the declared type, size cap) and
 * requires the object to be an image before persisting its path into
 * `instanceData.overview.heroImage`. Clearing the image goes through the plain
 * `updateDecisionInstance` mutation with an empty string.
 */
export async function updateOverviewHeroImage({
  input,
  user,
}: {
  input: UpdateOverviewHeroImageInput;
  user: User;
}): Promise<UpdateOverviewHeroImageResult> {
  const { instanceId, storagePath, mimeType } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { profileId: true },
  });
  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', instanceId);
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  const storageObject = await getStorageObjectByPath({ path: storagePath });
  const { storedMimeType } = assertUploadedStorageObject({
    storageObject,
    storagePath,
    requiredPathPrefix: overviewHeroImagePathPrefix(instanceId),
    declaredMimeType: mimeType,
    maxFileSize: DEFAULT_UPLOAD_SIZE_LIMIT,
  });
  // The shared allowlist also permits PDFs / office docs; the hero is
  // image-only, so reject anything that isn't an image.
  if (!storedMimeType.startsWith('image/')) {
    throw new ValidationError('Hero image must be an image file');
  }

  await updateDecisionInstance({
    instanceId,
    overview: { heroImage: storagePath },
    user,
  });
  await invalidateDecisionInstance(instanceId);

  return { heroImage: storagePath };
}
