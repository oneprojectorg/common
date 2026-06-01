import { AccessControlException } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils/error';
import { type ProfileTypePolicies, assertProfileTypeAccess } from '../access';
import {
  getProfileIdsForCollection,
  getScopesForResource,
} from './channelScope';

const isDenied = (error: unknown): boolean =>
  error instanceof AccessControlException || error instanceof UnauthorizedError;

// Asserts the user has the policy-required permission on at least one of the
// parent profiles. Returns the profileId that granted access — useful for
// resolving `addedBy` and other profile-scoped context. Profile order is
// normalized so the chosen profileId is deterministic across calls.
export const assertAnyParentProfileAccess = async ({
  user,
  parentProfileIds,
  policies,
}: {
  user: { id: string };
  parentProfileIds: string[];
  policies: ProfileTypePolicies;
}): Promise<string> => {
  const sortedProfileIds = [...new Set(parentProfileIds)].sort();
  if (sortedProfileIds.length === 0) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  for (const profileId of sortedProfileIds) {
    try {
      await assertProfileTypeAccess({
        user,
        profileIds: [profileId],
        policies,
      });
      return profileId;
    } catch (error) {
      if (!isDenied(error)) {
        throw error;
      }
    }
  }
  throw new UnauthorizedError("You don't have access to do this");
};

// Resolves the collection's parent profile(s) and asserts the user has access
// via at least one. Throws NotFoundError for unknown / unattached collections
// and lets UnauthorizedError propagate on denial.
export const assertCollectionAccess = async ({
  user,
  collectionId,
  policies,
}: {
  user: { id: string };
  collectionId: string;
  policies: ProfileTypePolicies;
}): Promise<{ parentProfileIds: string[]; parentProfileId: string }> => {
  const parentProfileIds = await getProfileIdsForCollection(collectionId);
  if (parentProfileIds.length === 0) {
    throw new NotFoundError('Collection', collectionId);
  }
  const parentProfileId = await assertAnyParentProfileAccess({
    user,
    parentProfileIds,
    policies,
  });
  return { parentProfileIds, parentProfileId };
};

// Resolves the collections a resource lives in and asserts the user has
// access via at least one parent profile of any of those collections.
export const assertResourceAccess = async ({
  user,
  resourceId,
  policies,
}: {
  user: { id: string };
  resourceId: string;
  policies: ProfileTypePolicies;
}): Promise<{ parentProfileIds: string[]; parentProfileId: string }> => {
  const { profileIds: parentProfileIds } =
    await getScopesForResource(resourceId);
  if (parentProfileIds.length === 0) {
    throw new NotFoundError('Resource', resourceId);
  }
  const parentProfileId = await assertAnyParentProfileAccess({
    user,
    parentProfileIds,
    policies,
  });
  return { parentProfileIds, parentProfileId };
};
