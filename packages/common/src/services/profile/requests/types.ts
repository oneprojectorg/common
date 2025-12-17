import { JoinProfileRequest, Profile } from '@op/db/schema';

export type JoinProfileRequestWithProfiles = JoinProfileRequest & {
  requestProfile: Profile;
  targetProfile: Profile;
};

export type JoinProfileRequestContext = {
  requestProfile: Profile;
  targetProfile: Profile;
  existingRequest: JoinProfileRequest | undefined;
  existingMembership: boolean;
};
