import { db } from '@op/db/client';

import { NotFoundError } from '../../utils';
import {
  type ProfileChatLine,
  clearProfileChatLine,
  getProfileChatLine,
  setProfileChatLine,
} from '../profile/profileChatLine';

const requireDecisionProfileId = async (
  instanceId: string,
): Promise<string> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision instance', instanceId);
  }
  if (!instance.profileId) {
    throw new NotFoundError('Decision profile', instanceId);
  }

  return instance.profileId;
};

export const getDecisionChatLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<ProfileChatLine | null> =>
  getProfileChatLine({ profileId: await requireDecisionProfileId(instanceId) });

export const setDecisionChatLine = async ({
  instanceId,
  phoneNumber,
}: {
  instanceId: string;
  phoneNumber: string;
}): Promise<ProfileChatLine> =>
  setProfileChatLine({
    profileId: await requireDecisionProfileId(instanceId),
    phoneNumber,
  });

export const clearDecisionChatLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ cleared: boolean }> =>
  clearProfileChatLine({
    profileId: await requireDecisionProfileId(instanceId),
  });
