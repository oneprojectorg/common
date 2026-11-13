import { checkPermission, permission } from 'access-zones';

import { type AccessUser, getProfileAccessRoles } from '../access';
import { getCachedInstance } from './getCachedInstance';
import { isLegacyInstanceData } from './isLegacyInstance';

/** Slug `/decisions/[slug]` will render for this caller; null for every miss, so existence never leaks. */
export const getConvertedInstanceSlug = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user?: AccessUser;
}): Promise<string | null> => {
  const instance = await getCachedInstance(instanceId);
  const profileId = instance?.profileId;
  const slug = instance?.profile?.slug;

  // Cheap misses first: most callers hit a legacy instance.
  if (!profileId || !slug || isLegacyInstanceData(instance?.instanceData)) {
    return null;
  }

  // Same permissions as getDecisionBySlug, so a redirect never lands on a forbidden page.
  const roles = await getProfileAccessRoles({ user, profileId });
  const canRead = checkPermission(
    [{ decisions: permission.ADMIN }, { decisions: permission.READ }],
    roles,
  );

  return canRead ? slug : null;
};
