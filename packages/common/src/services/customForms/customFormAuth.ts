import { type DbClient, db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  isUserEmailPlatformAdmin,
} from '../access';
import { readInstancePhases } from '../decision/readInstancePhases';

export type CustomFormProcessContext = {
  profileId: string;
  /** Phase a form with no `x-phase` falls back to. */
  initialPhaseId: string | null;
  phaseIds: string[];
};

/** The instance columns the authorization rule reads. */
export type CustomFormInstance = {
  id: string;
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
    columns: {
      id: true,
      profileId: true,
      ownerProfileId: true,
      instanceData: true,
    },
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
    ...(await readInstancePhaseSet({ instance })),
  };
};

/** The phase set an `x-phase` may name, in order. */
export const readInstancePhaseSet = async ({
  instance,
  db,
  fromRows,
}: {
  instance: { id: string; instanceData: unknown };
  db?: DbClient;
  fromRows?: boolean;
}): Promise<Pick<CustomFormProcessContext, 'initialPhaseId' | 'phaseIds'>> => {
  const phaseIds = (await readInstancePhases({ instance, db, fromRows })).map(
    (phase) => phase.phaseId,
  );

  return { initialPhaseId: phaseIds[0] ?? null, phaseIds };
};
