import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { assertProfileTypeAccess } from '../access';
import { assertCollectionAccess } from './resourceAuth';
import { type ResourceUploadUrl, signResourceUploadUrl } from './storage';

export type SignResourceUploadUrlTarget =
  | { kind: 'profile'; profileId: string }
  | { kind: 'collection'; collectionId: string };

export type SignResourceUploadUrlForTargetInput = {
  authUserId: string;
  target: SignResourceUploadUrlTarget;
  fileName: string;
};

export type SignResourceUploadUrlForTargetResult = ResourceUploadUrl & {
  profileId: string;
};

export const signResourceUploadUrlForTarget = async (
  input: SignResourceUploadUrlForTargetInput,
): Promise<SignResourceUploadUrlForTargetResult> => {
  const { target } = input;
  const policies = {
    [EntityType.DECISION]: { decisions: permission.ADMIN },
  };

  let profileId: string;
  if (target.kind === 'profile') {
    await assertProfileTypeAccess({
      user: { id: input.authUserId },
      profileIds: [target.profileId],
      policies,
    });
    profileId = target.profileId;
  } else {
    const { parentProfileId } = await assertCollectionAccess({
      user: { id: input.authUserId },
      collectionId: target.collectionId,
      policies,
    });
    profileId = parentProfileId;
  }

  const signed = await signResourceUploadUrl({
    profileId,
    fileName: input.fileName,
  });

  return { profileId, ...signed };
};
