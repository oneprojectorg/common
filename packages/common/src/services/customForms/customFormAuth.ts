import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  isUserEmailPlatformAdmin,
} from '../access';

const instancePhasesSchema = z
  .object({
    phases: z.array(z.object({ phaseId: z.string() })).optional(),
  })
  .partial();

export type CustomFormProcessContext = {
  profileId: string;
  /** Phase a form with no `x-phase` falls back to. */
  initialPhaseId: string | null;
  phaseIds: string[];
};

/** The instance columns the authorization rule reads. */
export type CustomFormInstance = {
  profileId: string | null;
  ownerProfileId: string | null;
  instanceData: unknown;
};

/** Admits a platform admin or an admin on the profile's decision process. */
export const assertCustomFormAdmin = async ({
  user,
  profileId,
}: {
  user: User;
  profileId: string;
}): Promise<CustomFormProcessContext> => {
  // One instance per profile: the column holds the instance's own profile.
  const instance = await db.query.processInstances.findFirst({
    where: { profileId },
    columns: { profileId: true, ownerProfileId: true, instanceData: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision process', profileId);
  }

  return assertCustomFormAdminForInstance({ user, instance });
};

/**
 * The same rule against an instance the caller already loaded, so a path that
 * reached it by join doesn't re-query it.
 */
export const assertCustomFormAdminForInstance = async ({
  user,
  instance,
}: {
  user: User;
  instance: CustomFormInstance;
}): Promise<CustomFormProcessContext> => {
  const isPlatformAdmin = !!user.email && isUserEmailPlatformAdmin(user.email);

  if (!isPlatformAdmin) {
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance,
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  }

  // The column is nullable and the platform-admin path skips the assert above.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  return {
    profileId: instance.profileId,
    ...parseInstancePhases(instance.instanceData),
  };
};

/** The phase set an `x-phase` may name, in order. */
export const parseInstancePhases = (
  instanceData: unknown,
): Pick<CustomFormProcessContext, 'initialPhaseId' | 'phaseIds'> => {
  const parsed = instancePhasesSchema.safeParse(instanceData);
  const phaseIds = (parsed.success ? (parsed.data.phases ?? []) : []).map(
    (phase) => phase.phaseId,
  );

  return { initialPhaseId: phaseIds[0] ?? null, phaseIds };
};
