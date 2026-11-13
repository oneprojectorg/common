import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type AccessUser, assertInstanceProfileAccess } from '../access';
import { getCachedInstance } from './getCachedInstance';
import { isLegacyInstanceData } from './isLegacyInstance';

/**
 * The slug the current decision route (`/decisions/[slug]`) serves an instance
 * at, so a legacy link can redirect there once the instance is converted.
 *
 * Returns `null` for a legacy instance, a missing instance, one without a
 * profile slug, and one the caller can't read: every miss looks the same, so
 * the result never reveals whether an unreadable instance exists.
 */
export const getConvertedInstanceSlug = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: AccessUser | undefined;
}): Promise<string | null> => {
  const instance = await getCachedInstance(instanceId);

  const slug = instance?.profile?.slug;

  // Cheap misses first: most callers hit a legacy instance.
  if (!instance || !slug || isLegacyInstanceData(instance.instanceData)) {
    return null;
  }

  try {
    await assertInstanceProfileAccess({
      user,
      instance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }

  return slug;
};
