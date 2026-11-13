import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import type { AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { getCachedInstance } from './getCachedInstance';
import { isLegacyInstanceData } from './isLegacyInstance';

/** Slug `/decisions/[slug]` will render for this caller; null for every miss, so existence never leaks. */
export const getConvertedInstanceSlug = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: AccessUser | undefined;
}): Promise<string | null> => {
  const instance = await getCachedInstance(instanceId);
  const profileId = instance?.profileId;
  const slug = instance?.profile?.slug;

  // Cheap misses first: most callers hit a legacy instance.
  if (!profileId || !slug || isLegacyInstanceData(instance?.instanceData)) {
    return null;
  }

  try {
    // Same check as getDecisionBySlug, so a redirect never lands on a forbidden page.
    await assertProfileAccess({
      user,
      profileId,
      permissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }

  return slug;
};
