import type { JoinProfileRequest, Profile } from '@op/db/schema';

import type { deleteProfileJoinRequest } from './deleteProfileJoinRequest';

/**
 * A join profile request with its associated request and target profiles.
 * This type is inferred from Drizzle v2 relational queries with the `with` clause.
 */
export type JoinProfileRequestWithProfiles = NonNullable<
  Awaited<ReturnType<typeof deleteProfileJoinRequest>>
>;

export type JoinProfileRequestContext = {
  requestProfile: Profile;
  targetProfile: Profile;
  existingRequest: JoinProfileRequest | undefined;
  existingMembership: boolean;
};
