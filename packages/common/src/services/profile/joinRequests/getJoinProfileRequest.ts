import { User } from '@op/supabase/lib';

import {
  JoinProfileRequestWithProfiles,
  validateJoinProfileRequestContext,
} from './validateJoinProfileRequestContext';

/**
 * Gets an existing join profile request between two profiles.
 * Returns the join profile request with associated profiles, or null if no request exists.
 */
export const getJoinProfileRequest = async ({
  user,
  requestProfileId,
  targetProfileId,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestWithProfiles | null> => {
  const { requestProfile, targetProfile, existingRequest } =
    await validateJoinProfileRequestContext({
      user,
      requestProfileId,
      targetProfileId,
    });

  if (!existingRequest) {
    return null;
  }

  return {
    ...existingRequest,
    requestProfile,
    targetProfile,
  };
};
