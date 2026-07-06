import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';
import { assertProfileAccess } from '../assert';
import { phaseHeroImagePathPrefix } from './phaseHeroImageStorage';

export interface SignPhaseHeroImageUploadUrlInput {
  instanceId: string;
  phaseId: string;
  fileName: string;
}

export interface SignPhaseHeroImageUploadUrlResult {
  storagePath: string;
  signedUrl: string;
  token: string;
}

/**
 * Issues a Supabase signed upload URL for a decision phase's hero image.
 * Admin-only: the caller must hold decisions ADMIN on the instance's profile,
 * asserted before any storage access so non-admins can't mint upload URLs. The
 * client PUTs the file binary straight to storage, then calls
 * `updatePhaseHeroImage` to validate + persist the path — the same signed-URL
 * flow the overview hero uses, so large photos never round-trip through the
 * tRPC body.
 */
export async function signPhaseHeroImageUploadUrl({
  input,
  user,
}: {
  input: SignPhaseHeroImageUploadUrlInput;
  user: User;
}): Promise<SignPhaseHeroImageUploadUrlResult> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: input.instanceId },
    columns: { profileId: true },
  });
  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', input.instanceId);
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  return signStorageUploadUrl({
    pathPrefix: phaseHeroImagePathPrefix(input.instanceId, input.phaseId),
    fileName: input.fileName,
  });
}
